import { compareMonths } from "@/lib/analytics/compare";
import { buildInsightMetrics, type InsightContent } from "@/lib/analytics/insight-metrics";
import { collapseCategories, summarizeMonth } from "@/lib/analytics/month";
import { detectRecurring, recurringSummary } from "@/lib/analytics/recurring";
import type { Category } from "@/lib/domain/categories";
import { toKRW } from "@/lib/domain/money";
import type { KRW, YearMonth } from "@/lib/domain/types";
import { DEMO_INSIGHT, DEMO_MONTHS, DEMO_TODAY, DEMO_TRANSACTIONS } from "./fixtures";

export type LandingCategory = Category | "기타";

export interface LandingSheetRow { date: string; merchant: string; amount: KRW; category: Category }
export interface LandingCategoryBar { category: LandingCategory; amount: KRW; share: number; width: number }
export interface LandingWeekday { label: "월" | "화" | "수" | "목" | "금" | "토" | "일"; amount: KRW; height: number; weekend: boolean }
export interface LandingRecurringItem { label: string; amount: KRW; width: number }

export interface LandingShowcase {
  month: YearMonth;
  previousMonth: YearMonth;
  total: KRW;
  count: number;
  sheetRows: LandingSheetRow[];
  categoryBars: LandingCategoryBar[];
  topCategory: { category: Category; amount: KRW; share: number };
  increase: { category: Category; previous: KRW; current: KRW; rate: number } | null;
  weekend: { share: number; days: LandingWeekday[] };
  recurring: { count: number; monthlyTotal: KRW; yearlyTotal: KRW; items: LandingRecurringItem[] };
  report: { netRate: number | null; weekendShare: number; content: InsightContent };
  chat: { category: Category; amount: KRW; topMerchant: string; topMerchantCount: number } | null;
}

const WEEKDAYS: readonly LandingWeekday["label"][] = ["월", "화", "수", "목", "금", "토", "일"];

function percentWidth(amount: KRW, maximum: KRW): number {
  return maximum === 0 ? 0 : Math.round(amount / maximum * 100);
}

function buildCategoryBars(summary: ReturnType<typeof summarizeMonth>): LandingCategoryBar[] {
  const categories = collapseCategories(summary.byCategory, 5);
  const total = toKRW(categories.reduce((sum, item) => sum + item.amount, 0));
  const maximum = toKRW(categories[0]?.amount ?? 0);
  const bars = categories.map((item) => ({
    category: item.category as LandingCategory,
    amount: toKRW(item.amount),
    share: total === 0 ? 0 : Math.round(item.amount / total * 100),
    width: percentWidth(item.amount, maximum),
  }));
  if (bars.length === 0) return bars;

  const remainderIndex = bars.findIndex(({ category }) => category === "기타");
  const adjustmentIndex = remainderIndex >= 0 ? remainderIndex : 0;
  const otherShare = bars.reduce((sum, item, index) => index === adjustmentIndex ? sum : sum + item.share, 0);
  bars[adjustmentIndex]!.share = 100 - otherShare;
  return bars;
}

function buildSheetRows(month: YearMonth): LandingSheetRow[] {
  const seen = new Set<Category>();
  const rows: LandingSheetRow[] = [];
  const eligible = DEMO_TRANSACTIONS
    .filter((tx) => tx.occurredOn.startsWith(month) && tx.kind === "spend" && tx.status === "posted")
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id));

  for (const tx of eligible) {
    if (seen.has(tx.category)) continue;
    seen.add(tx.category);
    rows.push({ date: tx.occurredOn.slice(5).replace("-", "."), merchant: tx.merchantRaw, amount: toKRW(tx.amountKrw), category: tx.category });
    if (rows.length === 5) break;
  }
  return rows;
}

function buildWeekdays(summary: ReturnType<typeof summarizeMonth>): LandingWeekday[] {
  const amounts = Array.from({ length: 7 }, () => 0);
  for (const item of summary.daily) {
    const [year, month, day] = item.date.split("-").map(Number);
    const utcDay = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
    const mondayFirstIndex = (utcDay + 6) % 7;
    amounts[mondayFirstIndex] = (amounts[mondayFirstIndex] ?? 0) + item.amount;
  }
  const maximum = toKRW(Math.max(...amounts));
  return WEEKDAYS.map((label, index) => {
    const amount = toKRW(amounts[index] ?? 0);
    return { label, amount, height: percentWidth(amount, maximum), weekend: index >= 5 };
  });
}

function buildChat(summary: ReturnType<typeof summarizeMonth>): LandingShowcase["chat"] {
  const categoryTotal = summary.byCategory.find(({ category }) => category === "카페·간식") ?? summary.byCategory[0];
  if (!categoryTotal) return null;

  const merchants = new Map<string, { label: string; count: number }>();
  for (const tx of DEMO_TRANSACTIONS) {
    if (!tx.occurredOn.startsWith(summary.month) || tx.category !== categoryTotal.category || tx.kind !== "spend" || tx.status === "cancelled") continue;
    const merchant = merchants.get(tx.merchantKey) ?? { label: tx.merchantRaw, count: 0 };
    merchant.label = tx.merchantRaw;
    merchant.count += 1;
    merchants.set(tx.merchantKey, merchant);
  }
  const top = [...merchants.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0]?.[1];
  if (!top) return null;
  return { category: categoryTotal.category, amount: toKRW(categoryTotal.amount), topMerchant: top.label, topMerchantCount: top.count };
}

function buildShowcase(): LandingShowcase {
  const month = DEMO_MONTHS[2];
  const previousMonth = DEMO_MONTHS[1];
  const summary = summarizeMonth([...DEMO_TRANSACTIONS], month);
  const previous = summarizeMonth([...DEMO_TRANSACTIONS], previousMonth);
  const comparison = compareMonths(summary, previous);
  const recurringItems = detectRecurring([...DEMO_TRANSACTIONS], DEMO_TODAY);
  const recurring = recurringSummary(recurringItems);
  const metrics = buildInsightMetrics(summary, previous, recurringItems);
  const categoryBars = buildCategoryBars(summary);
  const firstBar = categoryBars[0];
  if (!firstBar) throw new Error("Landing showcase requires category data");
  const increase = comparison.topIncreases.find((item) => item.diff > 0 && item.previous > 0);
  const recurringMaximum = toKRW(recurringItems[0]?.monthlyEstimate ?? 0);

  return {
    month,
    previousMonth,
    total: toKRW(summary.spend),
    count: summary.count,
    sheetRows: buildSheetRows(month),
    categoryBars,
    topCategory: { category: firstBar.category, amount: toKRW(firstBar.amount), share: firstBar.share },
    increase: increase ? {
      category: increase.category,
      previous: toKRW(increase.previous),
      current: toKRW(increase.current),
      rate: Math.round(increase.diff / increase.previous * 100),
    } : null,
    weekend: { share: Math.round(metrics.weekendShare * 100), days: buildWeekdays(summary) },
    recurring: {
      count: recurring.count,
      monthlyTotal: toKRW(recurring.monthlyTotal),
      yearlyTotal: toKRW(recurring.monthlyTotal * 12),
      items: recurringItems.slice(0, 5).map((item) => ({
        label: item.label,
        amount: toKRW(item.monthlyEstimate),
        width: percentWidth(item.monthlyEstimate, recurringMaximum),
      })),
    },
    report: {
      netRate: comparison.netRate === null ? null : Math.round(comparison.netRate * 100),
      weekendShare: Math.round(metrics.weekendShare * 100),
      content: DEMO_INSIGHT,
    },
    chat: buildChat(summary),
  };
}

const LANDING_SHOWCASE = buildShowcase();

export function getLandingShowcase(): LandingShowcase {
  return LANDING_SHOWCASE;
}
