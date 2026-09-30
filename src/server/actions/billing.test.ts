import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/domain/errors";

const mocks = vi.hoisted(() => ({
  getCustomerState: vi.fn(), getCheckout: vi.fn(), validateWebhook: vi.fn(), createCheckout: vi.fn(), createPortalSession: vi.fn(),
  get: vi.fn(), upsertIfNewer: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn(),
}));
vi.mock("@/services/billing/polar", () => ({
  getCustomerState: mocks.getCustomerState, getCheckout: mocks.getCheckout, validateWebhook: mocks.validateWebhook,
  createCheckout: mocks.createCheckout, createPortalSession: mocks.createPortalSession,
  WebhookVerificationError: class WebhookVerificationError extends Error {},
}));
vi.mock("@/server/admin", () => ({ adminEntitlements: { get: mocks.get, upsertIfNewer: mocks.upsertIfNewer } }));
vi.mock("@/server/env", () => ({ getServerEnv: () => ({ polarProProductId: "pro-product", appUrl: "https://finsight.example" }) }));
vi.mock("@/server/logger", () => ({ logger: { warn: mocks.warn, info: mocks.info, error: mocks.error } }));

import { WebhookVerificationError } from "@/services/billing/polar";
import { confirmCheckout, handlePolarWebhook, openPortal, startCheckout, syncEntitlement } from "./billing";

const uid = "11111111-1111-4111-8111-111111111111";
const state = (status = "active", end = "2026-10-01T00:00:00Z") => ({ subscriptions: [{
  id: "sub", status, productId: "pro-product", currentPeriodEnd: new Date(end), cancelAtPeriodEnd: false,
}] });

describe("billing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.useRealTimers();
    mocks.getCustomerState.mockResolvedValue(state());
    mocks.upsertIfNewer.mockResolvedValue("updated");
    mocks.get.mockResolvedValue(null);
    mocks.createCheckout.mockResolvedValue({ id: "co_1", url: "https://checkout.example/co_1" });
    mocks.createPortalSession.mockResolvedValue({ url: "https://portal.example/session" });
  });

  it("persists a customer-state-derived entitlement", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    await expect(syncEntitlement(uid)).resolves.toEqual({ outcome: "updated", plan: "pro" });
    expect(mocks.upsertIfNewer).toHaveBeenCalledWith(uid, { plan: "pro", status: "active", periodEnd: new Date("2026-10-01T00:00:00Z"), cancelAtPeriodEnd: false }, new Date("2026-09-27T00:00:00Z"));
  });

  it("keeps the later-started sync when the earlier request finishes last", async () => {
    vi.useFakeTimers();
    let resolveA!: (value: ReturnType<typeof state>) => void;
    const a = new Promise<ReturnType<typeof state>>((resolve) => { resolveA = resolve; });
    const memory = { syncedAt: new Date(0), status: "none" };
    mocks.getCustomerState.mockImplementationOnce(() => a).mockResolvedValueOnce(state("trialing", "2026-11-01T00:00:00Z"));
    mocks.upsertIfNewer.mockImplementation(async (_id, value, startedAt) => {
      if (startedAt > memory.syncedAt) { memory.syncedAt = startedAt; memory.status = value.status; return "updated"; }
      return "stale";
    });
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z")); const syncA = syncEntitlement(uid);
    vi.setSystemTime(new Date("2026-09-27T00:00:01Z")); const syncB = syncEntitlement(uid);
    await syncB; resolveA(state("active", "2026-10-01T00:00:00Z")); await syncA;
    expect(memory.status).toBe("trialing");
  });

  it("returns 403 without syncing for an invalid signature", async () => {
    mocks.validateWebhook.mockRejectedValue(new WebhookVerificationError());
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 403 });
    expect(mocks.getCustomerState).not.toHaveBeenCalled(); expect(mocks.upsertIfNewer).not.toHaveBeenCalled();
  });

  it.each([null, "not-a-uuid"])("acknowledges an unusable external id", async (externalCustomerId) => {
    mocks.validateWebhook.mockResolvedValue({ type: "subscription.updated", externalCustomerId });
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 200 });
    expect(mocks.warn).toHaveBeenCalledWith("billing.webhook.ignored", { type: "subscription.updated", reason: "invalid_external_customer_id" });
  });

  it("acknowledges unknown users and duplicate deliveries idempotently", async () => {
    mocks.validateWebhook.mockResolvedValue({ type: "subscription.updated", externalCustomerId: uid });
    mocks.upsertIfNewer.mockResolvedValueOnce("unknown_user");
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 200 });
    mocks.upsertIfNewer.mockResolvedValue("stale");
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 200 });
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 200 });
    expect(mocks.info).toHaveBeenLastCalledWith("billing.webhook.synced", { type: "subscription.updated", outcome: "stale" });
  });

  it("returns 500 when synchronization fails", async () => {
    mocks.validateWebhook.mockResolvedValue({ type: "subscription.updated", externalCustomerId: uid });
    mocks.getCustomerState.mockRejectedValue(new AppError("BILLING_UNAVAILABLE"));
    await expect(handlePolarWebhook("raw", new Headers())).resolves.toEqual({ status: 500 });
  });

  it("rejects another user's checkout and does not sync", async () => {
    mocks.getCheckout.mockResolvedValue({ status: "succeeded", externalCustomerId: "22222222-2222-4222-8222-222222222222" });
    await expect(confirmCheckout(uid, "co_1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getCustomerState).not.toHaveBeenCalled();
  });

  it("does not sync an open checkout and applies grace to current entitlement", async () => {
    mocks.getCheckout.mockResolvedValue({ status: "open", externalCustomerId: uid });
    mocks.get.mockResolvedValue({ plan: "pro", periodEnd: new Date(Date.now() - 3 * 86400000), freeInsightUsedAt: null, status: "past_due" });
    await expect(confirmCheckout(uid, "co_1")).resolves.toEqual({ plan: "pro", checkout: "open" });
    expect(mocks.getCustomerState).not.toHaveBeenCalled();
  });

  it("syncs a succeeded checkout", async () => {
    mocks.getCheckout.mockResolvedValue({ status: "succeeded", externalCustomerId: uid });
    await expect(confirmCheckout(uid, "co_1")).resolves.toEqual({ plan: "pro", checkout: "succeeded" });
  });

  it("syncs first and creates a server-owned checkout with a safe next path", async () => {
    mocks.getCustomerState.mockResolvedValue(null);
    await expect(startCheckout({ id: uid, email: "user@example.com" }, { returnTo: "https://evil.example", ipAddress: "203.0.113.1" })).resolves.toEqual({ url: "https://checkout.example/co_1" });
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      userId: uid, email: "user@example.com", ipAddress: "203.0.113.1",
      successUrl: "https://finsight.example/billing/success?checkout_id={CHECKOUT_ID}&next=%2Fdashboard",
      returnUrl: "https://finsight.example/pricing?checkout=failed",
    });
  });

  it("rejects checkout when synchronization finds Pro", async () => {
    await expect(startCheckout({ id: uid, email: null }, { ipAddress: null })).rejects.toMatchObject({ code: "ALREADY_SUBSCRIBED", status: 409 });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("opens the user's portal with the settings return URL", async () => {
    await expect(openPortal(uid)).resolves.toEqual({ url: "https://portal.example/session" });
    expect(mocks.createPortalSession).toHaveBeenCalledWith(uid, "https://finsight.example/settings");
  });
});
