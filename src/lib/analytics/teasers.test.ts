import { describe, expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import type { RecurringItem } from "./recurring";
import { buildFreePanel, buildProPanel } from "./teasers";
import { summarizeMonth } from "./month";
import type { IsoDate, YearMonth } from "@/lib/domain/types";

const ym = (value: string) => value as YearMonth;
const iso = (value: string) => value as IsoDate;
const recurring: RecurringItem[] = [{ merchantKey: "secret-key", label: "비밀가맹점", avgAmount: toKRW(9900), lastDate: iso("2026-09-01"), occurrences: 3, monthlyEstimate: toKRW(9900), nextExpectedDate: iso("2026-10-01") }];

describe("Pro panel builders", () => {
  it("Free 패널에는 정기결제 상세나 잠긴 수치가 누출되지 않는다", () => {
    const panel = buildFreePanel({ month: ym("2026-09"), recurring, previousHasData: true, monthsWithData: 2, freeInsightAvailable: true });
    expect(panel).toMatchObject({ kind: "free", recurring: { count: 1, monthlyTotal: 9900 }, comparisonLocked: { previousMonth: "2026-08" }, trendLocked: true, freeInsight: true });
    expect(JSON.stringify(panel)).not.toMatch(/비밀가맹점|secret-key|avgAmount|monthlyEstimate|lastDate|nextExpectedDate/);
  });

  it("표시할 데이터가 없는 Free 티저는 잠금 영역을 만들지 않는다", () => {
    expect(buildFreePanel({ month: ym("2026-09"), recurring: [], previousHasData: false, monthsWithData: 1, freeInsightAvailable: false })).toMatchObject({ recurring: null, comparisonLocked: null, trendLocked: false });
  });

  it("Pro 패널은 전월 비교와 정기결제 요약을 만든다", () => {
    const current = summarizeMonth([], ym("2026-09"));
    const previous = summarizeMonth([], ym("2026-08"));
    expect(buildProPanel({ month: ym("2026-09"), current, previous, recurring })).toMatchObject({ kind: "pro", delta: { month: "2026-09", previousMonth: "2026-08" }, recurring: { count: 1, monthlyTotal: 9900 } });
  });
});
