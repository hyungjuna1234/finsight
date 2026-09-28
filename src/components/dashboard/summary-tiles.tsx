import type { MonthSummary } from "@/lib/analytics/month";
import { formatKRW, formatSignedKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";

export function SummaryTiles({ summary }: { summary: MonthSummary }) {
  const tiles = [{ label: `${formatMonthLabel(summary.month, "short")} 지출`, value: formatSignedKRW(summary.net) }, { label: "환불", value: formatKRW(summary.refund) }, { label: "거래 건수", value: `${summary.count}건` }];
  return <div className="grid gap-3 md:grid-cols-3">{tiles.map((tile, index) => <div key={tile.label} className="rounded-md border border-line bg-surface p-5"><p className="text-sm font-medium text-muted">{tile.label}</p><p className={`mt-2 font-semibold tabular-nums text-ink ${index === 0 ? "text-3xl" : "text-xl"}`}>{tile.value}</p>{index === 0 && summary.pendingCount > 0 ? <p className="mt-2 text-sm text-warning">추정 금액 {summary.pendingCount}건 포함</p> : null}</div>)}</div>;
}
