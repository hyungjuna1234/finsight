import type { MonthDelta, TrendPoint } from "@/lib/analytics/compare";
import type { RecurringItem } from "@/lib/analytics/recurring";
import { formatKRW, formatSignedKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";
import type { KRW } from "@/lib/domain/types";

interface Insight { headline: string; points: readonly string[]; tips: readonly string[] }

export function DemoProPreview({ recurring, recurringTotal, trend, delta, insight }: { recurring: RecurringItem[]; recurringTotal: { count: number; monthlyTotal: KRW }; trend: TrendPoint[]; delta: MonthDelta; insight: Insight }) {
  const deltaClass = delta.netDiff >= 0 ? "text-spend-up" : "text-spend-down";
  return <div className="space-y-8">
    <div><h2 className="text-base font-semibold text-ink">Pro 기능 미리보기</h2><p className="mt-1 text-sm text-muted">정기 지출과 월별 변화, 지출 요약을 한곳에서 확인해요.</p></div>
    <section aria-labelledby="recurring-heading"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 id="recurring-heading" className="text-base font-semibold text-ink">정기결제</h3><p className="text-sm tabular-nums text-muted">{recurringTotal.count}건 · 월 {formatKRW(recurringTotal.monthlyTotal)}</p></div><ul className="mt-3 divide-y divide-line">{recurring.map((item) => <li key={item.merchantKey} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:gap-4"><span className="text-body">{item.label}</span><span className="tabular-nums text-ink">월 {formatKRW(item.monthlyEstimate)}</span><span className="tabular-nums text-muted">다음 예상일 {item.nextExpectedDate}</span></li>)}</ul></section>
    <section aria-labelledby="trend-heading"><h3 id="trend-heading" className="text-base font-semibold text-ink">월별 추이</h3><ul aria-label="월별 추이" className="mt-3 divide-y divide-line">{trend.map((point) => <li key={point.month} className="flex justify-between py-3 text-sm"><span className="text-body">{formatMonthLabel(point.month)}</span><span className="tabular-nums text-ink">{formatSignedKRW(point.net)}</span></li>)}</ul><p className="mt-3 text-sm text-body">전월 대비 <span data-testid="month-delta" className={`font-medium tabular-nums ${deltaClass}`}>{formatSignedKRW(delta.netDiff, { plus: true })}</span></p></section>
    <section aria-labelledby="insight-heading"><h3 id="insight-heading" className="text-base font-semibold text-ink">지출 인사이트</h3><p className="mt-3 font-medium text-ink">{insight.headline}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-body">{insight.points.map((point) => <li key={point}>{point}</li>)}{insight.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul><p className="mt-3 text-sm text-muted">지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요.</p></section>
  </div>;
}
