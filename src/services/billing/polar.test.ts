import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/domain/errors";

const sdk = vi.hoisted(() => {
  class PolarClientError extends Error {
    constructor(public statusCode: number) { super("private sdk detail"); }
  }
  class PolarNetworkError extends Error {}
  class PolarServerError extends Error {
    constructor(public statusCode: number) { super("private sdk detail"); }
  }
  class PolarRateLimitError extends PolarClientError {}
  class ResourceNotFound extends PolarClientError {}
  class AlreadyCanceledSubscription extends PolarClientError {}
  class PolarWebhookError extends Error {}
  class PolarWebhookVerificationError extends PolarWebhookError {}
  class PolarWebhookUnknownTypeError extends PolarWebhookError {
    constructor(public eventType?: string) { super("unknown"); }
  }
  const client = {
    checkouts: { create: vi.fn(), get: vi.fn() },
    customerSessions: { create: vi.fn() },
    customers: { getStateExternal: vi.fn() },
    subscriptions: { list: vi.fn(), revoke: vi.fn() },
  };
  return {
    PolarClientError, PolarNetworkError, PolarServerError, PolarRateLimitError,
    ResourceNotFound, AlreadyCanceledSubscription,
    PolarWebhookError, PolarWebhookVerificationError, PolarWebhookUnknownTypeError,
    client, createPolar: vi.fn(() => client), validateEvent: vi.fn(),
  };
});

vi.mock("@polar-sh/sdk", () => ({
  PolarClientError: sdk.PolarClientError,
  PolarNetworkError: sdk.PolarNetworkError,
  PolarServerError: sdk.PolarServerError,
  PolarRateLimitError: sdk.PolarRateLimitError,
}));

vi.mock("@polar-sh/sdk/2026-04", () => ({
  createPolar: sdk.createPolar,
  errors: {
    ResourceNotFound: sdk.ResourceNotFound,
    AlreadyCanceledSubscription: sdk.AlreadyCanceledSubscription,
  },
  webhooks: {
    validateEvent: sdk.validateEvent,
    PolarWebhookError: sdk.PolarWebhookError,
    PolarWebhookVerificationError: sdk.PolarWebhookVerificationError,
    PolarWebhookUnknownTypeError: sdk.PolarWebhookUnknownTypeError,
  },
}));

vi.mock("@/server/env", () => ({
  getServerEnv: () => ({
    polarAccessToken: "test-token",
    polarWebhookSecret: "test-secret",
    polarServer: "sandbox",
    polarProProductId: "product-pro",
  }),
}));

import {
  WebhookVerificationError,
  createCheckout,
  createPortalSession,
  getCheckout,
  getCustomerState,
  revokeSubscriptions,
  validateWebhook,
} from "./polar";

describe("Polar billing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.client.checkouts.create.mockResolvedValue({ id: "co_1", url: "https://pay.test" });
    sdk.client.checkouts.get.mockResolvedValue({ status: "succeeded", external_customer_id: "user-1" });
    sdk.client.customerSessions.create.mockResolvedValue({ customer_portal_url: "https://portal.test" });
    sdk.client.customers.getStateExternal.mockResolvedValue({ active_subscriptions: [] });
    sdk.client.subscriptions.list.mockResolvedValue({ items: [] });
  });

  it("creates a checkout with the authenticated user and preserves the placeholder", async () => {
    const successUrl = "https://app.test/billing/success?checkout_id={CHECKOUT_ID}";
    await expect(createCheckout({ userId: "user-1", email: "private@example.com", ipAddress: "127.0.0.1", successUrl })).resolves.toEqual({ id: "co_1", url: "https://pay.test" });
    expect(sdk.createPolar).toHaveBeenCalledWith({ accessToken: "test-token", environment: "sandbox", timeout: 15 });
    expect(sdk.client.checkouts.create).toHaveBeenCalledWith({
      products: ["product-pro"], external_customer_id: "user-1", success_url: successUrl,
      customer_email: "private@example.com", customer_ip_address: "127.0.0.1",
    });
  });

  it("rejects a success URL without the literal checkout placeholder", async () => {
    await expect(createCheckout({ userId: "user-1", successUrl: "https://app.test/success" })).rejects.toMatchObject({ code: "INTERNAL" });
    expect(sdk.client.checkouts.create).not.toHaveBeenCalled();
  });

  it("maps checkout and portal not-found responses", async () => {
    sdk.client.checkouts.get.mockRejectedValueOnce(new sdk.ResourceNotFound(404));
    sdk.client.customerSessions.create.mockRejectedValueOnce(new sdk.PolarClientError(422));
    await expect(getCheckout("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createPortalSession("user-1", "https://app.test/settings")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns null for a missing customer", async () => {
    sdk.client.customers.getStateExternal.mockRejectedValue(new sdk.ResourceNotFound(404));
    await expect(getCustomerState("user-1")).resolves.toBeNull();
  });

  it("merges active and past-due subscriptions and deduplicates by id", async () => {
    sdk.client.customers.getStateExternal.mockResolvedValue({ active_subscriptions: [
      { id: "sub-1", status: "active", product_id: "pro", current_period_end: "2026-10-01T00:00:00Z", cancel_at_period_end: false },
      { id: "sub-bad", status: "trialing", product_id: "pro", current_period_end: "invalid", cancel_at_period_end: true },
    ] });
    sdk.client.subscriptions.list.mockResolvedValue({ items: [
      { id: "sub-1", status: "past_due", product_id: "pro", current_period_end: "2026-10-02T00:00:00Z", cancel_at_period_end: false },
      { id: "sub-2", status: "past_due", product_id: "pro", current_period_end: "2026-10-03T00:00:00Z", cancel_at_period_end: true },
    ] });
    const state = await getCustomerState("user-1");
    expect(state?.subscriptions.map(({ id, status, currentPeriodEnd }) => [id, status, currentPeriodEnd?.toISOString() ?? null])).toEqual([
      ["sub-1", "active", "2026-10-01T00:00:00.000Z"], ["sub-bad", "trialing", null], ["sub-2", "past_due", "2026-10-03T00:00:00.000Z"],
    ]);
    expect(sdk.client.subscriptions.list).toHaveBeenCalledWith({ external_customer_id: "user-1", status: "past_due" });
  });

  it("revokes every relevant subscription and treats already-ended ones idempotently", async () => {
    sdk.client.customers.getStateExternal.mockResolvedValue({ active_subscriptions: [
      { id: "sub-1", status: "active", product_id: "pro", current_period_end: "2026-10-01T00:00:00Z", cancel_at_period_end: false },
    ] });
    sdk.client.subscriptions.list.mockResolvedValue({ items: [
      { id: "sub-2", status: "past_due", product_id: "pro", current_period_end: "2026-10-01T00:00:00Z", cancel_at_period_end: false },
    ] });
    sdk.client.subscriptions.revoke.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new sdk.AlreadyCanceledSubscription(403));
    await expect(revokeSubscriptions("user-1")).resolves.toBe(1);
    expect(sdk.client.subscriptions.revoke).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["customer.updated", { external_id: "user-c" }, "user-c"],
    ["subscription.updated", { customer: { external_id: "user-s" } }, "user-s"],
    ["order.created", { customer: { external_id: "user-o" } }, "user-o"],
    ["benefit_grant.created", { customer: { external_id: "user-b" } }, "user-b"],
    ["checkout.updated", { external_customer_id: "user-k" }, "user-k"],
    ["product.updated", { external_id: "ignored" }, null],
  ])("extracts external IDs for %s", async (type, data, expected) => {
    sdk.validateEvent.mockResolvedValue({ type, data });
    await expect(validateWebhook("raw-private-payload", new Headers({
      "webhook-id": "id", "webhook-timestamp": "time", "webhook-signature": "sig",
    }))).resolves.toEqual({ type, externalCustomerId: expected });
    expect(sdk.validateEvent).toHaveBeenCalledWith("raw-private-payload", {
      "webhook-id": "id", "webhook-timestamp": "time", "webhook-signature": "sig",
    }, "test-secret");
  });

  it("maps webhook verification failures and accepts unknown signed event types", async () => {
    sdk.validateEvent.mockRejectedValueOnce(new sdk.PolarWebhookVerificationError());
    await expect(validateWebhook("raw", new Headers())).rejects.toBeInstanceOf(WebhookVerificationError);
    sdk.validateEvent.mockRejectedValueOnce(new sdk.PolarWebhookUnknownTypeError("future.created"));
    await expect(validateWebhook("raw", new Headers())).resolves.toEqual({ type: "future.created", externalCustomerId: null });
  });

  it.each([
    new sdk.PolarNetworkError("private"), new sdk.PolarServerError(500), new sdk.PolarRateLimitError(429),
  ])("maps SDK outages to BILLING_UNAVAILABLE without logging sensitive inputs", async (error) => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sdk.client.checkouts.create.mockRejectedValue(error);
    let caught: unknown;
    try {
      await createCheckout({ userId: "user-1", email: "private@example.com", ipAddress: "127.0.0.1", successUrl: "https://app.test/{CHECKOUT_ID}" });
    } catch (value) { caught = value; }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({ code: "BILLING_UNAVAILABLE", detail: undefined });
    const log = consoleSpy.mock.calls.flat().join(" ");
    expect(log).not.toContain("private@example.com");
    expect(log).not.toContain("127.0.0.1");
    expect(log).not.toContain("private sdk detail");
    consoleSpy.mockRestore();
  });
});
