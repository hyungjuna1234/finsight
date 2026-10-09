import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/domain/errors";
import { AiCallError } from "@/services/claude/models";

const mocks = vi.hoisted(() => { const calls: string[] = []; return { calls, requireConsent: vi.fn(async () => { calls.push("consent"); }), getPlan: vi.fn(async () => ({ plan: "free", isPro: false, freeInsightAvailable: true })), assertDailyLimit: vi.fn(async () => { calls.push("limit"); }), recordAiUsage: vi.fn(async () => { calls.push("usage"); }), loadTxViews: vi.fn(), writeInsight: vi.fn(async () => { calls.push("claude"); return { content: { headline: "좋아요", points: ["요점"], tips: [] }, usage: { model: "model", inputTokens: 1, outputTokens: 1 } }; }), markFreeInsightUsed: vi.fn(async () => { calls.push("credit"); return true; }), releaseFreeInsight: vi.fn(async () => { calls.push("release"); }), upsert: vi.fn(async () => { calls.push("save"); return { error: null, data: [{ created_at: "2026-09-27T00:00:00Z" }] }; }) }; });
const { calls, getPlan, assertDailyLimit, recordAiUsage, loadTxViews, writeInsight, markFreeInsightUsed, releaseFreeInsight, upsert } = mocks;
vi.mock("@/server/auth", () => ({ requireConsent: mocks.requireConsent, getPlan: mocks.getPlan }));
vi.mock("@/server/limits", () => ({ assertDailyLimit: mocks.assertDailyLimit, recordAiUsage: mocks.recordAiUsage }));
vi.mock("@/server/tx-rows", () => ({ loadTxViews: mocks.loadTxViews }));
vi.mock("@/services/claude/insight", () => ({ writeInsight: mocks.writeInsight }));
vi.mock("@/server/admin", () => ({ adminEntitlements: { markFreeInsightUsed: mocks.markFreeInsightUsed, releaseFreeInsight: mocks.releaseFreeInsight } }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: async () => ({ from: () => ({ upsert: () => ({ select: () => mocks.upsert() }) }) }) }));
import { generateInsight } from "./insights";

const tx = { id: "1", cardId: null, occurredOn: "2026-09-05", merchantRaw: "가맹점", merchantKey: "key", amountKrw: 1000, kind: "spend", status: "posted", category: "식비", categorySource: "rule", installmentMonths: null, foreignAmount: null, foreignCurrency: null };
describe("generateInsight", () => {
  beforeEach(() => { calls.length = 0; vi.clearAllMocks(); getPlan.mockResolvedValue({ plan: "free", isPro: false, freeInsightAvailable: true }); loadTxViews.mockResolvedValue([tx]); upsert.mockImplementation(async () => { calls.push("save"); return { error: null, data: [{ created_at: "2026-09-27T00:00:00Z" }] }; }); });
  it("runs consent, plan, limit, credit, Claude, usage and save in order", async () => {
    await generateInsight("u", "2026-09" as never);
    expect(calls).toEqual(["consent", "limit", "credit", "claude", "usage", "save"]);
  });
  it("does not call Claude without a free credit", async () => { getPlan.mockResolvedValue({ plan: "free", isPro: false, freeInsightAvailable: false }); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "PRO_REQUIRED" }); expect(writeInsight).not.toHaveBeenCalled(); });
  it("does not call Claude over the limit", async () => { assertDailyLimit.mockRejectedValueOnce(new AppError("RATE_LIMITED")); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "RATE_LIMITED" }); expect(writeInsight).not.toHaveBeenCalled(); });
  it("rejects empty months", async () => { loadTxViews.mockResolvedValue([]); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "NO_DATA" }); });
  it("records spent tokens and releases claimed credit when Claude fails after responding", async () => { const usage = { model: "m", inputTokens: 7, outputTokens: 3 }; writeInsight.mockRejectedValueOnce(new AiCallError(usage)); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); expect(recordAiUsage).toHaveBeenCalledWith("u", "insight", usage); expect(releaseFreeInsight).toHaveBeenCalledTimes(1); expect(upsert).not.toHaveBeenCalled(); });
  it("releases claimed credit and does not save after AI failure", async () => { writeInsight.mockRejectedValueOnce(new AppError("AI_UNAVAILABLE")); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); expect(markFreeInsightUsed).toHaveBeenCalledTimes(1); expect(releaseFreeInsight).toHaveBeenCalledTimes(1); expect(upsert).not.toHaveBeenCalled(); expect(recordAiUsage).not.toHaveBeenCalled(); });
  it("rejects a lost concurrent claim before calling Claude", async () => { markFreeInsightUsed.mockResolvedValueOnce(false); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "PRO_REQUIRED" }); expect(writeInsight).not.toHaveBeenCalled(); expect(releaseFreeInsight).not.toHaveBeenCalled(); });
  it("records usage and releases claimed credit after saving fails", async () => { upsert.mockResolvedValueOnce({ error: { code: "private" }, data: null } as never); await expect(generateInsight("u", "2026-09" as never)).rejects.toMatchObject({ code: "INTERNAL" }); expect(recordAiUsage).toHaveBeenCalledTimes(1); expect(releaseFreeInsight).toHaveBeenCalledTimes(1); });
  it("does not consume Pro credit", async () => { getPlan.mockResolvedValue({ plan: "pro", isPro: true, freeInsightAvailable: false }); await generateInsight("u", "2026-09" as never); expect(markFreeInsightUsed).not.toHaveBeenCalled(); expect(releaseFreeInsight).not.toHaveBeenCalled(); });
});
