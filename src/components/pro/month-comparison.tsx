import type { MonthDelta } from "@/lib/analytics/compare";
import { formatSignedKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";

function signedPercent(rate: number | null): string {
  if (rate === null) return "비교 기준 없음";
  const value = Math.round(rate * 100);
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}%`;
}

export function MonthComparison({ delta }: { delta: MonthDelta }) {
  const color = delta.netDiff > 0 ? "text-spend-up" : delta.netDiff < 0 ? "text-spend-down" : "text-body";
  return <section aria-labelledby="comparison-heading"><h3 id="comparison-heading" className="text-base font-semibold text-ink">{formatMonthLabel(delta.previousMonth, "short")} 대비</h3><p data-testid="month-delta" className={`mt-2 font-medium tabular-nums ${color}`}>{formatSignedKRW(delta.netDiff, { plus: true })} · {signedPercent(delta.netRate)}</p>{delta.topIncreases.length > 0 ? <ul className="mt-3 space-y-2 text-sm text-body">{delta.topIncreases.map((item) => <li key={item.category} className="flex justify-between gap-4"><span>{item.category}</span><span className="tabular-nums text-spend-up">{formatSignedKRW(item.diff, { plus: true })}</span></li>)}</ul> : null}</section>;
}
