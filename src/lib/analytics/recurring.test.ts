import { describe, expect, it } from "vitest";

import { toKRW } from "@/lib/domain/money";
import type { IsoDate } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";

import { detectRecurring, recurringSummary } from "./recurring";

const iso = (value: string) => value as IsoDate;
const dates = (values: string[], amounts: number[] = [10_000, 10_000, 10_000]) =>
  values.map((occurredOn, index) => makeTx({
    occurredOn: iso(occurredOn), merchantKey: "sub", merchantRaw: `구독 ${index}`, amountKrw: toKRW(amounts[index] ?? 10_000),
  }));

describe("detectRecurring", () => {
  it.each([
    { name: "24일 간격", values: ["2026-06-01", "2026-06-25", "2026-07-19"], count: 0 },
    { name: "36일 간격", values: ["2026-05-01", "2026-06-06", "2026-07-12"], count: 0 },
    { name: "25일 간격", values: ["2026-06-01", "2026-06-26", "2026-07-21"], count: 1 },
    { name: "35일 간격", values: ["2026-05-01", "2026-06-05", "2026-07-10"], count: 1 },
  ])("$name의 경계를 판정한다", ({ values, count }) => {
    expect(detectRecurring(dates(values), iso("2026-08-01"))).toHaveLength(count);
  });

  it.each([
    { name: "+10% 경계", amounts: [11_000, 11_000, 10_000], count: 1 },
    { name: "소액 +1000원 경계", amounts: [2_000, 2_000, 1_000], count: 1 },
    { name: "가격 인상으로 중단", amounts: [7_000, 7_000, 10_000], count: 0 },
  ])("$name 금액 사슬을 판정한다", ({ amounts, count }) => {
    expect(detectRecurring(dates(["2026-06-01", "2026-07-01", "2026-07-31"], amounts), iso("2026-08-01"))).toHaveLength(count);
  });

  it.each([
    { name: "2회", txs: dates(["2026-07-01", "2026-07-31"]), asOf: "2026-08-01", count: 0 },
    { name: "46일 전 마지막", txs: dates(["2026-04-01", "2026-05-01", "2026-05-31"]), asOf: "2026-07-16", count: 0 },
    { name: "빈 배열", txs: [], asOf: "2026-08-01", count: 0 },
  ])("$name은 정기결제가 아니다", ({ txs, asOf, count }) => {
    expect(detectRecurring(txs, iso(asOf))).toHaveLength(count);
  });

  it("환불과 취소를 무시하고 평균, 다음 날짜, 최신 label을 계산한다", () => {
    const txs = [
      ...dates(["2026-05-31", "2026-06-30", "2026-07-30"], [10_000, 10_000, 10_000]),
      makeTx({ occurredOn: "2026-07-30", merchantKey: "sub", kind: "refund", amountKrw: toKRW(10_000) }),
      makeTx({ occurredOn: "2026-07-30", merchantKey: "sub", status: "cancelled", amountKrw: toKRW(10_000) }),
    ];
    expect(detectRecurring(txs, iso("2026-08-01"))).toEqual([{
      merchantKey: "sub", label: "구독 2", avgAmount: 10_000, lastDate: "2026-07-30", occurrences: 3,
      monthlyEstimate: 10_000, nextExpectedDate: "2026-08-29",
    }]);
  });

  it("월 추정액 내림차순으로 정렬하고 합계를 만든다", () => {
    const txs = [
      ...dates(["2026-05-31", "2026-06-30", "2026-07-30"], [10_000, 10_000, 10_000]),
      ...["2026-06-01", "2026-07-01", "2026-07-31"].map((occurredOn) => makeTx({ occurredOn: iso(occurredOn), merchantKey: "large", merchantRaw: "큰 구독", amountKrw: toKRW(20_000) })),
    ];
    const items = detectRecurring(txs, iso("2026-08-01"));
    expect(items.map(({ merchantKey }) => merchantKey)).toEqual(["large", "sub"]);
    expect(recurringSummary(items)).toEqual({ count: 2, monthlyTotal: 30_000 });
  });
});
