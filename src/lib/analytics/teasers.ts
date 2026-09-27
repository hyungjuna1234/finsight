import { compareMonths, type MonthDelta } from "@/lib/analytics/compare";
import type { MonthSummary } from "@/lib/analytics/month";
import { recurringSummary, type RecurringItem } from "@/lib/analytics/recurring";
import { CHAT_EXAMPLES } from "@/lib/domain/chat";
import { prevMonth } from "@/lib/domain/month";
import type { KRW, YearMonth } from "@/lib/domain/types";

export type RecurringTotal = { count: number; monthlyTotal: KRW };
export type ProPanel =
  | { kind: "pro"; month: YearMonth; delta: MonthDelta | null; recurring: RecurringTotal }
  | { kind: "free"; month: YearMonth; recurring: RecurringTotal | null; comparisonLocked: { previousMonth: YearMonth } | null; trendLocked: boolean; freeInsight: boolean; chatExamples: readonly string[] };

export function buildFreePanel(input: { month: YearMonth; recurring: RecurringItem[]; previousHasData: boolean; monthsWithData: number; freeInsightAvailable: boolean }): Extract<ProPanel, { kind: "free" }> {
  return {
    kind: "free",
    month: input.month,
    recurring: input.recurring.length > 0 ? recurringSummary(input.recurring) : null,
    comparisonLocked: input.previousHasData ? { previousMonth: prevMonth(input.month) } : null,
    trendLocked: input.monthsWithData >= 2,
    freeInsight: input.freeInsightAvailable,
    chatExamples: CHAT_EXAMPLES,
  };
}

export function buildProPanel(input: { month: YearMonth; current: MonthSummary; previous: MonthSummary | null; recurring: RecurringItem[] }): Extract<ProPanel, { kind: "pro" }> {
  return { kind: "pro", month: input.month, delta: input.previous ? compareMonths(input.current, input.previous) : null, recurring: recurringSummary(input.recurring) };
}
