import type { RecurringItem } from "@/lib/analytics/recurring";
import { formatKRW } from "@/lib/domain/money";

export function RecurringList({ items }: { items: RecurringItem[] }) {
  return <ul className="divide-y divide-line">{items.map((item) => <li key={item.merchantKey} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4"><span className="text-body">{item.label}</span><span className="tabular-nums text-ink">월 {formatKRW(item.monthlyEstimate)}</span><span className="tabular-nums text-muted">최근 결제일 {item.lastDate}</span><span className="tabular-nums text-muted">다음 예상일 {item.nextExpectedDate}</span></li>)}</ul>;
}
