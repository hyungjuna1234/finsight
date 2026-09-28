import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/server/logger", () => ({ logger: { warn: vi.fn() } }));

import { assertDailyLimit, kstDayStart, recordAiUsage, remainingDailyQuota } from "./limits";

describe("upload limits", () => {
  beforeEach(() => from.mockReset());

  it("computes the KST day boundary", () => {
    expect(kstDayStart(new Date("2026-01-01T16:00:00Z"))).toBe("2026-01-02T00:00:00+09:00");
  });

  it("rejects a reached upload limit", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(async () => ({ count: 30, error: null })) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    from.mockReturnValue(query);
    await expect(assertDailyLimit("u", "uploads")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("returns the remaining daily quota without going below zero", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(async () => ({ count: 32, error: null })) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    from.mockReturnValue(query);

    await expect(remainingDailyQuota("u", "uploads")).resolves.toBe(0);
  });

  it("counts classify usage from ai_usage with the classify feature", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(async () => ({ count: 4, error: null })) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    from.mockReturnValue(query);

    await expect(remainingDailyQuota("u", "classify")).resolves.toBe(96);
    expect(from).toHaveBeenCalledWith("ai_usage");
    expect(query.eq).toHaveBeenCalledWith("feature", "classify");
  });

  it("records normalized Claude usage", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    from.mockReturnValue({ insert });
    await recordAiUsage("u", "mapping", { model: "m", inputTokens: 1, outputTokens: 2 });
    expect(insert).toHaveBeenCalledWith({ user_id: "u", feature: "mapping", model: "m", input_tokens: 1, output_tokens: 2 });
  });
});
