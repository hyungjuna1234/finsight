import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEntitlementMock } = vi.hoisted(() => ({ getEntitlementMock: vi.fn() }));
vi.mock("@/server/admin", () => ({ adminEntitlements: { get: getEntitlementMock } }));

import { getPlan, requirePro } from "./auth";

describe("plan authorization", () => {
  const now = new Date("2026-09-27T00:00:00.000Z");

  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["missing row", null, { plan: "free", isPro: false, freeInsightAvailable: true }],
    ["active pro", { plan: "pro", status: "active", periodEnd: null, freeInsightUsedAt: null }, { plan: "pro", isPro: true, freeInsightAvailable: false }],
    ["expired pro at grace boundary", { plan: "pro", status: "past_due", periodEnd: new Date("2026-09-20T00:00:00.000Z"), freeInsightUsedAt: null }, { plan: "free", isPro: false, freeInsightAvailable: true }],
    ["used free insight", { plan: "free", status: "inactive", periodEnd: null, freeInsightUsedAt: new Date("2026-09-01T00:00:00.000Z") }, { plan: "free", isPro: false, freeInsightAvailable: false }],
  ] as const)("resolves %s", async (_label, row, expected) => {
    getEntitlementMock.mockResolvedValue(row);
    await expect(getPlan("user-1", now)).resolves.toEqual(expected);
    expect(getEntitlementMock).toHaveBeenCalledWith("user-1");
  });

  it("allows active Pro", async () => {
    getEntitlementMock.mockResolvedValue({ plan: "pro", status: "active", periodEnd: null, freeInsightUsedAt: null });
    await expect(requirePro("user-1", now)).resolves.toBeUndefined();
  });

  it("throws the public 402 error for Free", async () => {
    getEntitlementMock.mockResolvedValue(null);
    await expect(requirePro("user-1", now)).rejects.toMatchObject({ code: "PRO_REQUIRED", status: 402 });
  });
});
