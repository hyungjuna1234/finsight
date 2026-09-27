import "server-only";

import {
  PolarClientError,
  PolarNetworkError,
  PolarRateLimitError,
  PolarServerError,
} from "@polar-sh/sdk";
import { createPolar, errors, webhooks } from "@polar-sh/sdk/2026-04";

import type { BillingSubscription, CustomerState } from "@/lib/analytics/plan";
import { AppError } from "@/lib/domain/errors";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";

export type CheckoutState = "open" | "expired" | "confirmed" | "succeeded" | "failed";

export interface BillingWebhookEvent {
  type: string;
  externalCustomerId: string | null;
}

export class WebhookVerificationError extends Error {
  constructor() {
    super("Polar webhook verification failed");
    this.name = "WebhookVerificationError";
  }
}

let client: ReturnType<typeof createPolar> | undefined;

function getClient(): ReturnType<typeof createPolar> {
  const env = getServerEnv();
  client ??= createPolar({
    accessToken: env.polarAccessToken,
    environment: env.polarServer,
    timeout: 15,
  });
  return client;
}

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  return typeof error.statusCode === "number" ? error.statusCode : null;
}

function unavailable(operation: string, error: unknown): never {
  logger.error(`billing.polar.${operation}`, error, { status: statusOf(error) });
  throw new AppError("BILLING_UNAVAILABLE");
}

function isSdkError(error: unknown): boolean {
  return error instanceof PolarNetworkError
    || error instanceof PolarServerError
    || error instanceof PolarRateLimitError
    || error instanceof PolarClientError;
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toSubscription(value: {
  id: string;
  status: string;
  product_id: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}): BillingSubscription {
  return {
    id: value.id,
    status: value.status,
    productId: value.product_id,
    currentPeriodEnd: toDate(value.current_period_end),
    cancelAtPeriodEnd: value.cancel_at_period_end,
  };
}

export async function createCheckout(input: {
  userId: string;
  email?: string | null;
  ipAddress?: string | null;
  successUrl: string;
  returnUrl?: string;
}): Promise<{ id: string; url: string }> {
  if (!input.successUrl.includes("{CHECKOUT_ID}")) throw new AppError("INTERNAL");

  try {
    const env = getServerEnv();
    const checkout = await getClient().checkouts.create({
      products: [env.polarProProductId],
      external_customer_id: input.userId,
      success_url: input.successUrl,
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.email ? { customer_email: input.email } : {}),
      ...(input.ipAddress ? { customer_ip_address: input.ipAddress } : {}),
    });
    return { id: checkout.id, url: checkout.url };
  } catch (error) {
    return unavailable("create_checkout", error);
  }
}

export async function getCheckout(checkoutId: string): Promise<{
  status: CheckoutState;
  externalCustomerId: string | null;
}> {
  try {
    const checkout = await getClient().checkouts.get(checkoutId);
    return { status: checkout.status, externalCustomerId: checkout.external_customer_id };
  } catch (error) {
    if (error instanceof errors.ResourceNotFound || statusOf(error) === 404) {
      throw new AppError("NOT_FOUND");
    }
    return unavailable("get_checkout", error);
  }
}

export async function createPortalSession(userId: string, returnUrl: string): Promise<{ url: string }> {
  try {
    const session = await getClient().customerSessions.create({
      external_customer_id: userId,
      return_url: returnUrl,
    });
    return { url: session.customer_portal_url };
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 422) throw new AppError("NOT_FOUND");
    return unavailable("create_portal_session", error);
  }
}

export async function getCustomerState(userId: string): Promise<CustomerState | null> {
  try {
    const polar = getClient();
    const state = await polar.customers.getStateExternal(userId);
    const pastDue = await polar.subscriptions.list({
      external_customer_id: userId,
      status: "past_due",
    });
    const subscriptions = new Map<string, BillingSubscription>();
    for (const subscription of state.active_subscriptions) {
      subscriptions.set(subscription.id, toSubscription(subscription));
    }
    for (const subscription of pastDue.items) {
      if (!subscriptions.has(subscription.id)) {
        subscriptions.set(subscription.id, toSubscription(subscription));
      }
    }
    return { subscriptions: [...subscriptions.values()] };
  } catch (error) {
    if (error instanceof errors.ResourceNotFound || statusOf(error) === 404) return null;
    return unavailable("get_customer_state", error);
  }
}

export async function revokeSubscriptions(userId: string): Promise<number> {
  const state = await getCustomerState(userId);
  if (state === null) return 0;

  let revoked = 0;
  for (const subscription of state.subscriptions) {
    if (!["active", "trialing", "past_due"].includes(subscription.status)) continue;
    try {
      await getClient().subscriptions.revoke(subscription.id);
      revoked += 1;
    } catch (error) {
      if (error instanceof errors.AlreadyCanceledSubscription || statusOf(error) === 404) continue;
      return unavailable("revoke_subscription", error);
    }
  }
  return revoked;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function externalCustomerId(type: string, data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (type.startsWith("customer.")) return nonEmptyString(record.external_id);
  if (type.startsWith("checkout.")) return nonEmptyString(record.external_customer_id);
  if (["subscription.", "order.", "benefit_grant."].some((prefix) => type.startsWith(prefix))) {
    const customer = record.customer;
    return typeof customer === "object" && customer !== null
      ? nonEmptyString((customer as Record<string, unknown>).external_id)
      : null;
  }
  return null;
}

export async function validateWebhook(rawBody: string, headers: Headers): Promise<BillingWebhookEvent> {
  const selectedHeaders = {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
  };

  try {
    const event = await webhooks.validateEvent(rawBody, selectedHeaders, getServerEnv().polarWebhookSecret);
    return {
      type: event.type,
      externalCustomerId: externalCustomerId(event.type, event.data),
    };
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return { type: error.eventType ?? "unknown", externalCustomerId: null };
    }
    if (error instanceof webhooks.PolarWebhookError) throw new WebhookVerificationError();
    if (isSdkError(error)) return unavailable("validate_webhook", error);
    return unavailable("validate_webhook", error);
  }
}
