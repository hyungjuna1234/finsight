"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKRW } from "@/lib/domain/money";
import type { IsoDate, TxView, YearMonth } from "@/lib/domain/types";
import { CategorySheet } from "./category-sheet";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
function dateLabel(date: IsoDate) { const [year, month, day] = date.split("-"); const weekday = weekdays[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()]; return `${Number(month)}월 ${Number(day)}일 (${weekday})`; }

export function TransactionList({ groups, month, nextCursorHref }: { groups: { date: IsoDate; items: TxView[]; net: number }[]; month: YearMonth; nextCursorHref: string | null }) {
  const [selected, setSelected] = useState<TxView | null>(null);
  return <section aria-label={`${month} 거래 목록`} className="space-y-6">{groups.map((group) => <div key={group.date}><div className="flex justify-between border-b border-line pb-2"><h2 className="text-sm font-semibold text-ink">{dateLabel(group.date)}</h2><span className="text-sm tabular-nums text-muted">{group.net < 0 ? "−" : ""}{formatKRW(Math.abs(group.net) as TxView["amountKrw"])}</span></div><ul>{group.items.map((tx) => <li key={tx.id} className={`flex items-start justify-between gap-4 border-b border-line py-4 ${tx.status === "cancelled" ? "line-through text-disabled" : ""}`}><div className="min-w-0"><p className="truncate text-sm text-ink">{tx.merchantRaw}</p><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted"><button type="button" onClick={() => setSelected(tx)} className="rounded-md border border-line px-2 py-1 no-underline">{tx.category}</button>{tx.status === "pending" ? <span className="text-warning">추정</span> : null}{tx.status === "cancelled" ? <span>취소</span> : null}{tx.installmentMonths ? <span>{tx.installmentMonths}개월 할부</span> : null}</div></div><p className="shrink-0 text-sm tabular-nums text-ink">{tx.kind === "refund" ? "−" : ""}{formatKRW(tx.amountKrw)}{tx.kind === "refund" ? <span className="ml-1 text-xs text-muted">환불</span> : null}</p></li>)}</ul></div>)}{nextCursorHref ? <Link href={nextCursorHref} className="inline-block rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink">더 보기</Link> : null}{selected ? <CategorySheet tx={{ id: selected.id, merchantRaw: selected.merchantRaw, category: selected.category }} onClose={() => setSelected(null)} /> : null}</section>;
}
