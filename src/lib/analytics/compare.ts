import { CATEGORIES, type Category } from "@/lib/domain/categories";
import { toKRW } from "@/lib/domain/money";
import type { KRW, TxView, YearMonth } from "@/lib/domain/types";

import { summarizeMonth, type MonthSummary } from "./month";

export interface CategoryDelta { category: Category; current: KRW; previous: KRW; diff: number }
export interface MonthDelta { month: YearMonth; previousMonth: YearMonth; netDiff: number; netRate: number | null; topIncreases: CategoryDelta[] }
export interface TrendPoint { month: YearMonth; net: number }

export function compareMonths(current: MonthSummary, previous: MonthSummary): MonthDelta {
  const currentByCategory = new Map(current.byCategory.map((item) => [item.category, item.amount]));
  const previousByCategory = new Map(previous.byCategory.map((item) => [item.category, item.amount]));
  const topIncreases = CATEGORIES.map((category) => {
    const currentAmount = currentByCategory.get(category) ?? toKRW(0);
    const previousAmount = previousByCategory.get(category) ?? toKRW(0);
    return { category, current: currentAmount, previous: previousAmount, diff: currentAmount - previousAmount };
  })
    .filter(({ diff }) => diff > 0)
    .sort((a, b) => b.diff - a.diff || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))
    .slice(0, 3);
  const netDiff = current.net - previous.net;
  return {
    month: current.month,
    previousMonth: previous.month,
    netDiff,
    netRate: previous.net > 0 ? netDiff / previous.net : null,
    topIncreases,
  };
}

export function monthlyTrend(txs: TxView[], months: YearMonth[]): TrendPoint[] {
  return months.map((month) => ({ month, net: summarizeMonth(txs, month).net }));
}
