import { CATEGORIES, type Category } from "@/lib/domain/categories";
import { toKRW } from "@/lib/domain/money";
import { addDays, monthRange } from "@/lib/domain/month";
import type { IsoDate, KRW, TxView, YearMonth } from "@/lib/domain/types";

export interface CategoryTotal { category: Category; amount: KRW; count: number }
export interface MerchantTotal { merchantKey: string; label: string; amount: KRW; count: number }
export interface DailyTotal { date: IsoDate; amount: KRW }
export interface MonthSummary {
  month: YearMonth;
  spend: KRW;
  refund: KRW;
  net: number;
  count: number;
  byCategory: CategoryTotal[];
  topMerchants: MerchantTotal[];
  daily: DailyTotal[];
  pendingCount: number;
}

const categoryOrder = new Map(CATEGORIES.map((category, index) => [category, index]));

export function summarizeMonth(txs: TxView[], month: YearMonth): MonthSummary {
  const { from, to } = monthRange(month);
  const active = txs.filter((tx) => tx.occurredOn >= from && tx.occurredOn <= to && tx.status !== "cancelled");
  let spend = 0;
  let refund = 0;
  let pendingCount = 0;
  const categories = new Map<Category, { net: number; spendCount: number }>();
  const merchants = new Map<string, { net: number; spendCount: number; label: string; latest: IsoDate; latestIndex: number }>();
  const dailySpend = new Map<IsoDate, number>();

  active.forEach((tx, index) => {
    const direction = tx.kind === "spend" ? 1 : -1;
    if (tx.kind === "spend") {
      spend += tx.amountKrw;
      dailySpend.set(tx.occurredOn, (dailySpend.get(tx.occurredOn) ?? 0) + tx.amountKrw);
    } else {
      refund += tx.amountKrw;
    }
    if (tx.status === "pending") pendingCount += 1;

    const category = categories.get(tx.category) ?? { net: 0, spendCount: 0 };
    category.net += direction * tx.amountKrw;
    if (tx.kind === "spend") category.spendCount += 1;
    categories.set(tx.category, category);

    const merchant = merchants.get(tx.merchantKey) ?? { net: 0, spendCount: 0, label: tx.merchantRaw, latest: tx.occurredOn, latestIndex: index };
    merchant.net += direction * tx.amountKrw;
    if (tx.kind === "spend") merchant.spendCount += 1;
    if (tx.occurredOn > merchant.latest || (tx.occurredOn === merchant.latest && index > merchant.latestIndex)) {
      merchant.label = tx.merchantRaw;
      merchant.latest = tx.occurredOn;
      merchant.latestIndex = index;
    }
    merchants.set(tx.merchantKey, merchant);
  });

  const byCategory = [...categories.entries()]
    .filter(([, value]) => value.net > 0)
    .map(([category, value]) => ({ category, amount: toKRW(value.net), count: value.spendCount }))
    .sort((a, b) => b.amount - a.amount || (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0));

  const topMerchants = [...merchants.entries()]
    .filter(([, value]) => value.net > 0)
    .map(([merchantKey, value]) => ({ merchantKey, label: value.label, amount: toKRW(value.net), count: value.spendCount }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.merchantKey.localeCompare(b.merchantKey))
    .slice(0, 5);

  const daily: DailyTotal[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    daily.push({ date, amount: toKRW(dailySpend.get(date) ?? 0) });
  }

  return {
    month,
    spend: toKRW(spend),
    refund: toKRW(refund),
    net: spend - refund,
    count: active.length,
    byCategory,
    topMerchants,
    daily,
    pendingCount,
  };
}

export function collapseCategories(items: CategoryTotal[], max = 8): CategoryTotal[] {
  const regular = items.filter(({ category }) => category !== "기타");
  const kept = regular.slice(0, max);
  const remainder = [...regular.slice(max), ...items.filter(({ category }) => category === "기타")];
  if (remainder.length === 0) return kept;
  return [
    ...kept,
    {
      category: "기타",
      amount: toKRW(remainder.reduce((sum, item) => sum + item.amount, 0)),
      count: remainder.reduce((sum, item) => sum + item.count, 0),
    },
  ];
}
