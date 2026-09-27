import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminSupabaseMock } = vi.hoisted(() => ({ createAdminSupabaseMock: vi.fn() }));
vi.mock("@/services/supabase/admin", () => ({ createAdminSupabase: createAdminSupabaseMock }));

import { adminEntitlements } from "./admin";

describe("adminEntitlements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no row exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    createAdminSupabaseMock.mockReturnValue({ from: vi.fn(() => ({ select })) });

    await expect(adminEntitlements.get("user-1")).resolves.toBeNull();
    expect(select).toHaveBeenCalledWith("plan,status,period_end,free_insight_used_at");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("converts entitlement timestamps to Dates", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { plan: "pro", status: "active", period_end: "2026-10-01T00:00:00.000Z", free_insight_used_at: "2026-09-01T00:00:00.000Z" },
      error: null,
    });
    createAdminSupabaseMock.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    });

    await expect(adminEntitlements.get("user-1")).resolves.toEqual({
      plan: "pro",
      status: "active",
      periodEnd: new Date("2026-10-01T00:00:00.000Z"),
      freeInsightUsedAt: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it.each([[1, true], [0, false]] as const)("marks the free insight conditionally (%i updated)", async (updatedRows, expected) => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn().mockResolvedValue({ data: Array.from({ length: updatedRows }, () => ({ user_id: "user-1" })), error: null });
    const is = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ is }));
    const update = vi.fn(() => ({ eq }));
    createAdminSupabaseMock.mockReturnValue({ from: vi.fn(() => ({ upsert, update })) });

    await expect(adminEntitlements.markFreeInsightUsed("user-1")).resolves.toBe(expected);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", plan: "free", status: "inactive", period_end: null, synced_at: null, free_insight_used_at: null },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    expect(is).toHaveBeenCalledWith("free_insight_used_at", null);
    expect(select).toHaveBeenCalledWith("user_id");
  });
});
