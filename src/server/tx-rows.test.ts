import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/lib/domain/types";
import { hasTxInRange, loadDataMonthSpan, loadTxViews, toTxView, type ServerSupabase } from "./tx-rows";

const row = (id: number) => ({ id: `t${id}`, card_id: null, occurred_on: "2026-09-01", merchant_raw: "상점", merchant_key: "상점", amount_krw: 1000, kind: "spend" as const, status: "posted" as const, category: "식비", category_source: "rule" as const, installment_months: null, foreign_amount: null, foreign_currency: null });

function pagedSb(rows: ReturnType<typeof row>[]) {
  const ranges: Array<[number, number]> = [];
  const query = { select: () => query, eq: () => query, gte: () => query, lte: () => query, order: () => query, range: async (from: number, to: number) => { ranges.push([from, to]); return { data: rows.slice(from, to + 1), error: null }; } };
  return { sb: { from: () => query } as unknown as ServerSupabase, ranges };
}

describe("transaction row loaders", () => {
  it("DB 행을 안전한 TxView로 변환한다", () => {
    expect(toTxView(row(1))).toMatchObject({ id: "t1", occurredOn: "2026-09-01", amountKrw: 1000, category: "식비" });
  });

  it("1000행 단위로 마지막 페이지까지 읽는다", async () => {
    const { sb, ranges } = pagedSb(Array.from({ length: 1003 }, (_, i) => row(i)));
    const result = await loadTxViews(sb, "u1", { from: "2026-09-01" as IsoDate, to: "2026-09-30" as IsoDate });
    expect(result).toHaveLength(1003);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  it("첫 거래와 마지막 거래의 월을 읽고 빈 데이터는 null을 반환한다", async () => {
    const dates = ["2026-02-01", "2026-11-30"];
    let call = 0;
    const makeQuery = () => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: dates[call] ? [{ occurred_on: dates[call++] }] : [], error: null }) }; return q; };
    const sb = { from: () => makeQuery() } as unknown as ServerSupabase;
    expect(await loadDataMonthSpan(sb, "u1")).toEqual({ first: "2026-02", last: "2026-11" });
  });

  it("범위 안 거래 존재 여부만 한 행 조회한다", async () => {
    const calls: string[] = [];
    const query = { select: (v: string) => { calls.push(v); return query; }, eq: () => query, gte: () => query, lte: () => query, limit: async (n: number) => ({ data: n === 1 ? [{ id: "t1" }] : [], error: null }) };
    expect(await hasTxInRange({ from: () => query } as unknown as ServerSupabase, "u1", { from: "2026-08-01" as IsoDate, to: "2026-08-31" as IsoDate })).toBe(true);
    expect(calls).toEqual(["id"]);
  });
});
