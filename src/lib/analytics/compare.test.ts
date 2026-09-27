import { describe, expect, it } from "vitest";

import { toKRW } from "@/lib/domain/money";
import type { YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";

import { compareMonths, monthlyTrend } from "./compare";
import { summarizeMonth } from "./month";

const ym = (value: string) => value as YearMonth;

describe("compareMonths", () => {
  it.each([
    { previous: 100, current: 120, rate: 0.2 },
    { previous: 0, current: 120, rate: null },
    { previous: -10, current: 20, rate: null },
  ])("이전 순지출 $previous에서 $current의 증감률을 계산한다", ({ previous, current, rate }) => {
    const previousSummary = { ...summarizeMonth([], ym("2026-08")), net: previous };
    const currentSummary = { ...summarizeMonth([], ym("2026-09")), net: current };
    expect(compareMonths(currentSummary, previousSummary).netRate).toBe(rate);
  });

  it("한쪽에만 있는 카테고리를 포함해 증가액 상위 3개를 고른다", () => {
    const previous = summarizeMonth([
      makeTx({ occurredOn: "2026-08-01", category: "식비", amountKrw: toKRW(50) }),
      makeTx({ occurredOn: "2026-08-01", category: "교통", amountKrw: toKRW(30) }),
    ], ym("2026-08"));
    const current = summarizeMonth([
      makeTx({ category: "식비", amountKrw: toKRW(60) }),
      makeTx({ category: "쇼핑", amountKrw: toKRW(50) }),
      makeTx({ category: "교육", amountKrw: toKRW(40) }),
      makeTx({ category: "교통", amountKrw: toKRW(35) }),
    ], ym("2026-09"));
    expect(compareMonths(current, previous).topIncreases.map(({ category, diff }) => [category, diff])).toEqual([
      ["쇼핑", 50], ["교육", 40], ["식비", 10],
    ]);
  });
});

describe("monthlyTrend", () => {
  it("입력 월 순서를 유지하고 빈 달은 0으로 만든다", () => {
    const txs = [makeTx({ occurredOn: "2026-09-01", amountKrw: toKRW(30) })];
    expect(monthlyTrend(txs, [ym("2026-10"), ym("2026-09")])).toEqual([
      { month: "2026-10", net: 0 }, { month: "2026-09", net: 30 },
    ]);
  });
});
