import type { IsoDate, TxView } from "@/lib/domain/types";

export function groupByDate(txs: TxView[]): { date: IsoDate; items: TxView[]; net: number }[] {
  const groups = new Map<IsoDate, TxView[]>();
  for (const tx of txs) groups.set(tx.occurredOn, [...(groups.get(tx.occurredOn) ?? []), tx]);
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => ({ date, items, net: items.reduce((sum, tx) => tx.status === "cancelled" ? sum : sum + (tx.kind === "refund" ? -tx.amountKrw : tx.amountKrw), 0) }));
}
