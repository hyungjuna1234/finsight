import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), requireConsent: vi.fn(), createSb: vi.fn(), span: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: mocks.requireConsent }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
vi.mock("@/server/tx-rows", async (original) => ({ ...(await original<typeof import("@/server/tx-rows")>()), loadDataMonthSpan: mocks.span }));
import { listTransactions, TX_PAGE_SIZE } from "./transactions";

function query(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "gte", "lte", "ilike", "order", "range"]) q[name] = vi.fn(() => q);
  q.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return q;
}

beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "u1" }); mocks.span.mockResolvedValue({ first: "2026-09", last: "2026-09" }); });

describe("listTransactions", () => {
  it("applies safe filters and computes the next cursor from one extra row", async () => {
    const rows = Array.from({ length: TX_PAGE_SIZE + 1 }, (_, i) => ({ id: String(i), card_id: null, occurred_on: "2026-09-01", merchant_raw: "m", merchant_key: "m", amount_krw: 1, kind: "spend", status: "posted", category: "기타", category_source: "rule", installment_months: null, foreign_amount: null, foreign_currency: null }));
    const tx = query({ data: rows, error: null }); const cards = query({ data: [], error: null });
    mocks.createSb.mockResolvedValue({ from: vi.fn().mockReturnValueOnce(tx).mockReturnValueOnce(cards) });
    const result = await listTransactions({ month: "2026-09" as never, category: "식비", cardId: "550e8400-e29b-41d4-a716-446655440000", q: "a%_\\b", cursor: 10 });
    expect(tx.eq).toHaveBeenCalledWith("category", "식비");
    expect(tx.eq).toHaveBeenCalledWith("card_id", "550e8400-e29b-41d4-a716-446655440000");
    expect(tx.ilike).toHaveBeenCalledWith("merchant_raw", "%a\\%\\_\\\\b%");
    expect(tx.range).toHaveBeenCalledWith(10, 10 + TX_PAGE_SIZE);
    expect(result).toMatchObject({ state: "ready", nextCursor: 110 });
    if (result.state === "ready") expect(result.items).toHaveLength(TX_PAGE_SIZE);
  });
});
