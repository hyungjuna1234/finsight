import { toYearMonth } from "@/lib/domain/month";
import type { Category } from "@/lib/domain/categories";
import type { IsoDate, TxKind, TxView } from "@/lib/domain/types";

export type GroupBy = "category" | "month" | "merchant";
export interface SpendingGroup { key: string; label: string; amount: number; count: number }
export interface SearchRow { date: IsoDate; merchant: string; amount: number; kind: TxKind; category: Category; estimated: boolean }

const cappedLimit = (limit = 30): number => Math.max(0, Math.min(30, Math.trunc(limit)));

export function groupSpending(txs: TxView[], by: GroupBy, limit = 30): SpendingGroup[] {
  const groups = new Map<string, SpendingGroup>();
  for (const tx of txs) {
    if (tx.status === "cancelled") continue;
    const key = by === "category" ? tx.category : by === "month" ? toYearMonth(tx.occurredOn) : tx.merchantKey;
    const label = by === "merchant" ? tx.merchantRaw : key;
    const current = groups.get(key) ?? { key, label, amount: 0, count: 0 };
    current.amount += (tx.kind === "spend" ? 1 : -1) * tx.amountKrw;
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, cappedLimit(limit));
}

export function toSearchRows(txs: TxView[], limit = 30): SearchRow[] {
  return txs.filter((tx) => tx.status !== "cancelled").slice(0, cappedLimit(limit)).map((tx) => ({
    date: tx.occurredOn,
    merchant: tx.merchantRaw,
    amount: tx.amountKrw,
    kind: tx.kind,
    category: tx.category,
    estimated: tx.status === "pending",
  }));
}
