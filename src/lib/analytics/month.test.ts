import { describe, expect, it } from "vitest";

import { toKRW } from "@/lib/domain/money";
import type { YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";

import { collapseCategories, summarizeMonth } from "./month";

const ym = (value: string) => value as YearMonth;

describe("summarizeMonth", () => {
  it("빈 달도 모든 날짜를 0원으로 채운다", () => {
    const result = summarizeMonth([], ym("2026-09"));
    expect(result).toMatchObject({ spend: 0, refund: 0, net: 0, count: 0, byCategory: [], topMerchants: [], pendingCount: 0 });
    expect(result.daily).toHaveLength(30);
    expect(result.daily.every(({ amount }) => amount === 0)).toBe(true);
  });

  it("월 경계, 취소, 환불, pending, 할부를 정의대로 집계한다", () => {
    const txs = [
      makeTx({ occurredOn: "2026-08-31", amountKrw: toKRW(99_000) }),
      makeTx({ occurredOn: "2026-09-01", merchantKey: "meal", merchantRaw: "식당 옛 이름", category: "식비", amountKrw: toKRW(30_000) }),
      makeTx({ occurredOn: "2026-09-03", merchantKey: "meal", merchantRaw: "식당 새 이름", category: "식비", amountKrw: toKRW(60_000), installmentMonths: 3, status: "pending" }),
      makeTx({ occurredOn: "2026-09-04", merchantKey: "meal", merchantRaw: "식당", category: "식비", amountKrw: toKRW(100_000), status: "cancelled" }),
      makeTx({ occurredOn: "2026-09-05", merchantKey: "meal", merchantRaw: "식당", category: "식비", amountKrw: toKRW(120_000), kind: "refund" }),
    ];
    const result = summarizeMonth(txs, ym("2026-09"));
    expect(result).toMatchObject({ spend: 90_000, refund: 120_000, net: -30_000, count: 3, byCategory: [], pendingCount: 1 });
    expect(result.topMerchants).toEqual([]);
    expect(result.daily.find(({ date }) => date === "2026-09-03")?.amount).toBe(60_000);
    expect(result.daily.find(({ date }) => date === "2026-09-05")?.amount).toBe(0);
  });

  it("카테고리와 가맹점 동률을 규칙대로 정렬하고 최근 label을 쓴다", () => {
    const txs = [
      makeTx({ occurredOn: "2026-09-01", merchantKey: "z", merchantRaw: "예전", category: "교통", amountKrw: toKRW(20_000) }),
      makeTx({ occurredOn: "2026-09-02", merchantKey: "z", merchantRaw: "최근", category: "교통", amountKrw: toKRW(10_000) }),
      makeTx({ occurredOn: "2026-09-03", merchantKey: "a", merchantRaw: "에이", category: "식비", amountKrw: toKRW(30_000) }),
      makeTx({ occurredOn: "2026-09-04", merchantKey: "b", merchantRaw: "비", category: "쇼핑", amountKrw: toKRW(30_000) }),
    ];
    const result = summarizeMonth(txs, ym("2026-09"));
    expect(result.byCategory.map(({ category }) => category)).toEqual(["식비", "교통", "쇼핑"]);
    expect(result.topMerchants.map(({ merchantKey }) => merchantKey)).toEqual(["z", "a", "b"]);
    expect(result.topMerchants[0]).toMatchObject({ label: "최근", count: 2 });
  });

  it("윤년 2월의 모든 날짜를 만든다", () => {
    expect(summarizeMonth([], ym("2024-02")).daily).toHaveLength(29);
  });
});

describe("collapseCategories", () => {
  it.each([
    { max: 2, expected: [["식비", 50], ["교통", 40], ["기타", 50]] },
    { max: 8, expected: [["식비", 50], ["교통", 40], ["쇼핑", 30], ["기타", 20]] },
  ])("상위 $max개 밖과 기존 기타를 합친다", ({ max, expected }) => {
    const items = [
      { category: "식비" as const, amount: toKRW(50), count: 1 },
      { category: "교통" as const, amount: toKRW(40), count: 1 },
      { category: "쇼핑" as const, amount: toKRW(30), count: 2 },
      { category: "기타" as const, amount: toKRW(20), count: 3 },
    ];
    expect(collapseCategories(items, max).map(({ category, amount }) => [category, amount])).toEqual(expected);
  });
});
