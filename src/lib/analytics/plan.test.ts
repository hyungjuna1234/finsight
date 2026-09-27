import { describe, expect, it } from "vitest";

import { derivePlan, isProActive, PRO_GRACE_DAYS, type CustomerState, type EntitlementLike } from "./plan";

describe("derivePlan", () => {
  const now = new Date("2026-09-27T00:00:00.000Z");
  const subscription = (overrides: Partial<CustomerState["subscriptions"][number]> = {}) => ({
    id: "sub-1", status: "active", productId: "pro", currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"), cancelAtPeriodEnd: false, ...overrides,
  });

  it.each([
    ["active", subscription({ status: "active" }), "pro"],
    ["trialing", subscription({ status: "trialing" }), "pro"],
    ["past_due", subscription({ status: "past_due" }), "pro"],
    ["canceled in period", subscription({ status: "canceled", cancelAtPeriodEnd: true }), "pro"],
    ["canceled after period", subscription({ status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2026-09-26T00:00:00Z") }), "free"],
    ["other product", subscription({ productId: "other" }), "free"],
  ])("maps %s", (_label, value, expected) => {
    expect(derivePlan({ subscriptions: [value] }, now, "pro").plan).toBe(expected);
  });

  it("selects the eligible subscription with the latest period end", () => {
    const result = derivePlan({ subscriptions: [
      subscription({ id: "early", status: "trialing" }),
      subscription({ id: "late", status: "past_due", currentPeriodEnd: new Date("2026-11-01T00:00:00Z") }),
    ] }, now, "pro");
    expect(result).toEqual({ plan: "pro", status: "past_due", periodEnd: new Date("2026-11-01T00:00:00Z") });
  });

  it("retains the latest pro-product status for free and handles null state", () => {
    expect(derivePlan({ subscriptions: [
      subscription({ status: "canceled", currentPeriodEnd: new Date("2026-08-01T00:00:00Z") }),
      subscription({ status: "revoked", currentPeriodEnd: new Date("2026-09-01T00:00:00Z") }),
    ] }, now, "pro")).toEqual({ plan: "free", status: "revoked", periodEnd: null });
    expect(derivePlan(null, now, "pro")).toEqual({ plan: "free", status: "none", periodEnd: null });
  });

  it("leaves the seven-day past-due grace decision to isProActive", () => {
    const entitlement = derivePlan({ subscriptions: [subscription({ status: "past_due", currentPeriodEnd: new Date("2026-09-24T00:00:00Z") })] }, now, "pro");
    expect(isProActive(entitlement, now)).toBe(true);
    expect(isProActive(entitlement, new Date("2026-10-02T00:00:00Z"))).toBe(false);
  });
});

describe("isProActive", () => {
  const periodEnd = new Date("2026-09-20T00:00:00.000Z");
  const graceEnd = periodEnd.getTime() + PRO_GRACE_DAYS * 24 * 60 * 60 * 1_000;

  it.each<[string, EntitlementLike | null, Date, boolean]>([
    ["missing entitlement", null, periodEnd, false],
    ["free plan", { plan: "free", periodEnd: null }, periodEnd, false],
    ["pro without an end", { plan: "pro", periodEnd: null }, periodEnd, true],
    ["pro with a future end", { plan: "pro", periodEnd: new Date("2026-10-01T00:00:00.000Z") }, periodEnd, true],
    ["one millisecond before grace ends", { plan: "pro", periodEnd }, new Date(graceEnd - 1), true],
    ["exactly when grace ends", { plan: "pro", periodEnd }, new Date(graceEnd), false],
    ["long after grace ends", { plan: "pro", periodEnd }, new Date("2027-01-01T00:00:00.000Z"), false],
  ])("returns %s as %s", (_label, entitlement, now, expected) => {
    expect(isProActive(entitlement, now)).toBe(expected);
  });
});
