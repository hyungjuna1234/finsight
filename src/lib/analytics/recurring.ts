import { toKRW } from "@/lib/domain/money";
import { addDays, daysBetween } from "@/lib/domain/month";
import type { IsoDate, KRW, TxView } from "@/lib/domain/types";

export const RECURRING_RULES = { minOccurrences: 3, minGapDays: 25, maxGapDays: 35, amountRate: 0.1, amountAbs: 1000, activeWithinDays: 45 } as const;

export interface RecurringItem {
  merchantKey: string;
  label: string;
  avgAmount: KRW;
  lastDate: IsoDate;
  occurrences: number;
  monthlyEstimate: KRW;
  nextExpectedDate: IsoDate;
}

export function detectRecurring(txs: TxView[], asOf: IsoDate): RecurringItem[] {
  const groups = new Map<string, TxView[]>();
  for (const tx of txs) {
    if (tx.kind !== "spend" || tx.status === "cancelled") continue;
    const group = groups.get(tx.merchantKey) ?? [];
    group.push(tx);
    groups.set(tx.merchantKey, group);
  }

  const result: RecurringItem[] = [];
  for (const [merchantKey, group] of groups) {
    const sorted = group.map((tx, index) => ({ tx, index })).sort((a, b) => a.tx.occurredOn.localeCompare(b.tx.occurredOn) || a.index - b.index);
    const latestEntry = sorted.at(-1);
    if (!latestEntry) continue;
    const latest = latestEntry.tx;
    const chain = [latest];
    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      const candidate = sorted[index]?.tx;
      const newer = chain[chain.length - 1];
      if (!candidate || !newer) break;
      const gap = daysBetween(candidate.occurredOn, newer.occurredOn);
      const amountDifference = Math.abs(candidate.amountKrw - latest.amountKrw);
      const amountMatches = amountDifference <= latest.amountKrw * RECURRING_RULES.amountRate || amountDifference <= RECURRING_RULES.amountAbs;
      if (gap < RECURRING_RULES.minGapDays || gap > RECURRING_RULES.maxGapDays || !amountMatches) break;
      chain.push(candidate);
    }
    const activeDays = daysBetween(latest.occurredOn, asOf);
    if (chain.length < RECURRING_RULES.minOccurrences || activeDays < 0 || activeDays > RECURRING_RULES.activeWithinDays) continue;
    const avgAmount = toKRW(Math.round(chain.reduce((sum, tx) => sum + tx.amountKrw, 0) / chain.length));
    const chronological = [...chain].reverse();
    let totalGap = 0;
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = chronological[index - 1];
      const current = chronological[index];
      if (previous && current) totalGap += daysBetween(previous.occurredOn, current.occurredOn);
    }
    const averageGap = Math.round(totalGap / (chronological.length - 1));
    result.push({
      merchantKey,
      label: latest.merchantRaw,
      avgAmount,
      lastDate: latest.occurredOn,
      occurrences: chain.length,
      monthlyEstimate: avgAmount,
      nextExpectedDate: addDays(latest.occurredOn, averageGap),
    });
  }
  return result.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate || a.merchantKey.localeCompare(b.merchantKey));
}

export function recurringSummary(items: RecurringItem[]): { count: number; monthlyTotal: KRW } {
  return { count: items.length, monthlyTotal: toKRW(items.reduce((sum, item) => sum + item.monthlyEstimate, 0)) };
}
