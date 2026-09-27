import { describe, expect, it } from "vitest";

import { isProActive, PRO_GRACE_DAYS, type EntitlementLike } from "./plan";

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
