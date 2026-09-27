import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/domain/errors";

const mocks = vi.hoisted(() => ({ requireConsent: vi.fn(), requirePro: vi.fn(), assertDailyLimit: vi.fn(), recordAiUsage: vi.fn(), loadTxViews: vi.fn(), chat: vi.fn(), createSb: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireConsent: mocks.requireConsent, requirePro: mocks.requirePro }));
vi.mock("@/server/limits", () => ({ assertDailyLimit: mocks.assertDailyLimit, recordAiUsage: mocks.recordAiUsage }));
vi.mock("@/server/tx-rows", async () => ({ loadTxViews: mocks.loadTxViews, toTxView: (row: Record<string, unknown>) => ({ id: row.id, occurredOn: row.occurred_on, merchantRaw: row.merchant_raw, amountKrw: row.amount_krw, kind: row.kind, status: row.status, category: row.category }) }));
vi.mock("@/services/claude/chat", () => ({ chat: mocks.chat }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
import { createChatTools, sendChatMessage } from "./chat";

function query(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "gte", "lte", "ilike", "order", "limit"]) q[name] = vi.fn(() => q);
  q.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return q;
}

describe("createChatTools", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.loadTxViews.mockResolvedValue([]); });
  it("uses strict schemas without userId", () => {
    for (const tool of createChatTools("owner")) expect(tool.inputSchema.safeParse({ userId: "other", from: "2026-01-01", to: "2026-01-31", groupBy: "category" }).success).toBe(false);
  });
  it("pins every database query to the closure user and caps rows", async () => {
    const q = query({ data: Array.from({ length: 30 }, (_, index) => ({ id: String(index), occurred_on: "2026-09-01", merchant_raw: "가맹점", merchant_key: "m", amount_krw: 1, kind: "spend", status: "posted", category: "식비", category_source: "rule", card_id: null, installment_months: null, foreign_amount: null, foreign_currency: null })), error: null });
    mocks.createSb.mockResolvedValue({ from: vi.fn(() => q) });
    const tools = createChatTools("owner");
    await tools[0]!.run({ from: "2026-01-01", to: "2026-01-31", groupBy: "category" } as never);
    const result = JSON.parse(await tools[1]!.run({ from: "2026-01-01", to: "2026-01-31", query: "%_", limit: 30 } as never));
    expect(mocks.loadTxViews).toHaveBeenCalledWith(expect.anything(), "owner", expect.anything());
    expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(q.ilike).toHaveBeenCalledWith("merchant_raw", "%\\%\\_%");
    expect(result).toHaveLength(30);
  });
  it("does not read the database after five shared calls", async () => {
    const tools = createChatTools("owner", { maxCalls: 5 });
    for (let index = 0; index < 5; index += 1) await tools[0]!.run({ from: "2026-01-01", to: "2026-01-31", groupBy: "category" } as never);
    const before = mocks.loadTxViews.mock.calls.length;
    expect(await tools[1]!.run({ from: "2026-01-01", to: "2026-01-31" } as never)).toContain("호출 한도");
    expect(mocks.loadTxViews).toHaveBeenCalledTimes(before);
  });
});

describe("sendChatMessage", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.chat.mockResolvedValue({ text: "답", usage: { model: "m", inputTokens: 1, outputTokens: 2 } }); });
  it("checks consent, Pro and limit before Claude, then records token usage", async () => {
    await expect(sendChatMessage("owner", { history: [], message: "질문" })).resolves.toEqual({ text: "답" });
    expect(mocks.requireConsent).toHaveBeenCalledWith("owner");
    expect(mocks.requirePro).toHaveBeenCalledWith("owner");
    expect(mocks.assertDailyLimit).toHaveBeenCalledWith("owner", "chat");
    expect(mocks.recordAiUsage).toHaveBeenCalledWith("owner", "chat", expect.anything());
  });
  it.each([["free", "requirePro", "PRO_REQUIRED"], ["limit", "assertDailyLimit", "RATE_LIMITED"]] as const)("does not call Claude for %s", async (_name, method, code) => {
    mocks[method].mockRejectedValueOnce(new AppError(code));
    await expect(sendChatMessage("owner", { history: [], message: "질문" })).rejects.toMatchObject({ code });
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
