import "server-only";

import { derivePlan, isProActive } from "@/lib/analytics/plan";
import { AppError } from "@/lib/domain/errors";
import { safeRedirect } from "@/lib/domain/redirect";
import type { Plan } from "@/lib/domain/types";
import { adminEntitlements } from "@/server/admin";
import type { SessionUser } from "@/server/auth";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";
import {
  createCheckout,
  createPortalSession,
  getCheckout,
  getCustomerState,
  validateWebhook,
  WebhookVerificationError,
  type CheckoutState,
} from "@/services/billing/polar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startCheckout(
  user: SessionUser,
  input: { returnTo?: string; ipAddress: string | null },
): Promise<{ url: string }> {
  const synced = await syncEntitlement(user.id);
  if (synced.plan === "pro") throw new AppError("ALREADY_SUBSCRIBED");

  const appUrl = getServerEnv().appUrl;
  const next = encodeURIComponent(safeRedirect(input.returnTo, "/dashboard"));
  const checkout = await createCheckout({
    userId: user.id,
    email: user.email,
    ipAddress: input.ipAddress,
    successUrl: `${appUrl}/billing/success?checkout_id={CHECKOUT_ID}&next=${next}`,
    returnUrl: `${appUrl}/pricing?checkout=failed`,
  });
  return { url: checkout.url };
}

export async function openPortal(userId: string): Promise<{ url: string }> {
  return createPortalSession(userId, `${getServerEnv().appUrl}/settings`);
}

export async function syncEntitlement(userId: string): Promise<{
  outcome: "updated" | "stale" | "unknown_user";
  plan: Plan;
}> {
  const startedAt = new Date();
  const state = await getCustomerState(userId);
  const result = derivePlan(state, new Date(), getServerEnv().polarProProductId);
  const outcome = await adminEntitlements.upsertIfNewer(userId, result, startedAt);
  return { outcome, plan: result.plan };
}

export async function confirmCheckout(userId: string, checkoutId: string): Promise<{
  plan: Plan;
  checkout: CheckoutState;
}> {
  const checkout = await getCheckout(checkoutId);
  if (checkout.externalCustomerId !== userId) throw new AppError("FORBIDDEN");
  if (checkout.status === "succeeded" || checkout.status === "confirmed") {
    const result = await syncEntitlement(userId);
    return { plan: result.plan, checkout: checkout.status };
  }

  const entitlement = await adminEntitlements.get(userId);
  return { plan: isProActive(entitlement, new Date()) ? "pro" : "free", checkout: checkout.status };
}

export async function handlePolarWebhook(rawBody: string, headers: Headers): Promise<{ status: 200 | 403 | 500 }> {
  let event: Awaited<ReturnType<typeof validateWebhook>>;
  try {
    event = await validateWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return { status: 403 };
    logger.error("billing.webhook.failed", error);
    return { status: 500 };
  }

  if (event.externalCustomerId === null || !UUID.test(event.externalCustomerId)) {
    logger.warn("billing.webhook.ignored", { type: event.type, reason: "invalid_external_customer_id" });
    return { status: 200 };
  }

  try {
    const { outcome } = await syncEntitlement(event.externalCustomerId);
    if (outcome === "unknown_user") {
      logger.warn("billing.webhook.ignored", { type: event.type, reason: "unknown_user" });
    } else {
      logger.info("billing.webhook.synced", { type: event.type, outcome });
    }
    return { status: 200 };
  } catch (error) {
    logger.error("billing.webhook.failed", error, { type: event.type });
    return { status: 500 };
  }
}
