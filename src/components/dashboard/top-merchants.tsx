import type { MerchantTotal } from "@/lib/analytics/month";
import { formatKRW } from "@/lib/domain/money";

export function TopMerchants({ items }: { items: MerchantTotal[] }) {
  return <ol className="divide-y divide-line">{items.map((item, index) => <li key={item.merchantKey} className="flex items-center gap-3 py-3 text-sm"><span className="w-5 tabular-nums text-muted">{index + 1}</span><span className="min-w-0 flex-1 truncate text-body">{item.label}</span><span className="tabular-nums text-muted">{item.count}건</span><span className="w-28 text-right tabular-nums text-ink">{formatKRW(item.amount)}</span></li>)}</ol>;
}
