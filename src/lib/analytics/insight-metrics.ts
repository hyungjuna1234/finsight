import { z } from "zod";
import { compareMonths } from "@/lib/analytics/compare";
import { collapseCategories, type MonthSummary } from "@/lib/analytics/month";
import { recurringSummary, type RecurringItem } from "@/lib/analytics/recurring";
import type { Category } from "@/lib/domain/categories";
import type { KRW, YearMonth } from "@/lib/domain/types";

export const InsightContentSchema = z.object({
  headline: z.string().min(1).max(80),
  points: z.array(z.string().min(1).max(200)).min(1).max(5),
  tips: z.array(z.string().min(1).max(200)).max(3),
}).strict();
export type InsightContent = z.infer<typeof InsightContentSchema>;

export interface InsightMetrics {
  month: YearMonth; net: number; spend: KRW; refund: KRW; count: number; pendingCount: number;
  categories: { category: Category; amount: KRW; share: number; count: number }[];
  weekendShare: number;
  previous: { month: YearMonth; net: number; netRate: number | null; increases: { category: Category; diff: number }[] } | null;
  recurring: { count: number; monthlyTotal: KRW };
}

export function buildInsightMetrics(summary: MonthSummary, previous: MonthSummary | null, recurring: RecurringItem[]): InsightMetrics {
  const categoryTotal = summary.byCategory.reduce((sum, item) => sum + item.amount, 0);
  const weekend = summary.daily.reduce((sum, item) => {
    const [year, month, day] = item.date.split("-").map(Number);
    const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
    return sum + (weekday === 0 || weekday === 6 ? item.amount : 0);
  }, 0);
  const comparison = previous ? compareMonths(summary, previous) : null;
  return {
    month: summary.month, net: summary.net, spend: summary.spend, refund: summary.refund, count: summary.count, pendingCount: summary.pendingCount,
    categories: collapseCategories(summary.byCategory).map((item) => ({ ...item, share: categoryTotal === 0 ? 0 : item.amount / categoryTotal })),
    weekendShare: summary.spend === 0 ? 0 : weekend / summary.spend,
    previous: comparison ? { month: comparison.previousMonth, net: previous!.net, netRate: comparison.netRate, increases: comparison.topIncreases.map(({ category, diff }) => ({ category, diff })) } : null,
    recurring: recurringSummary(recurring),
  };
}

export function containsNumber(text: string): boolean { return /[0-9０-９]/.test(text); }
export function insightHasNumbers(content: InsightContent): boolean { return [content.headline, ...content.points, ...content.tips].some(containsNumber); }
