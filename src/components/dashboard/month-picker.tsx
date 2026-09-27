import Link from "next/link";
import { formatMonthLabel, nextMonth, prevMonth } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";

export function MonthPicker({ month, availableMonths, basePath }: { month: YearMonth; availableMonths: YearMonth[]; basePath: string }) {
  const previous = prevMonth(month); const next = nextMonth(month);
  const monthLink = (value: YearMonth) => `${basePath}?month=${value}`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {availableMonths.includes(previous) ? <Link href={monthLink(previous)} className="text-sm text-muted hover:text-ink">‹ 이전 달</Link> : <span aria-disabled="true" className="text-sm text-disabled">‹ 이전 달</span>}
        <strong className="text-base font-semibold text-ink">{formatMonthLabel(month)}</strong>
        {availableMonths.includes(next) ? <Link href={monthLink(next)} className="text-sm text-muted hover:text-ink">다음 달 ›</Link> : <span aria-disabled="true" className="text-sm text-disabled">다음 달 ›</span>}
      </div>
      <details className="text-sm"><summary className="cursor-pointer text-muted">전체 달 보기</summary><div className="mt-2 flex flex-wrap gap-2">{availableMonths.map((value) => <Link key={value} href={monthLink(value)} aria-current={value === month ? "page" : undefined} className="rounded-md border border-line bg-surface px-3 py-2 text-body aria-[current=page]:border-accent aria-[current=page]:text-accent">{formatMonthLabel(value)}</Link>)}</div></details>
    </div>
  );
}
