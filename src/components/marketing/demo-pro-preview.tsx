import type { MonthDelta, TrendPoint } from "@/lib/analytics/compare";
import type { RecurringItem } from "@/lib/analytics/recurring";
import type { KRW } from "@/lib/domain/types";
import { MonthComparison } from "@/components/pro/month-comparison";
import { RecurringList } from "@/components/pro/recurring-list";
import { RecurringSummary } from "@/components/pro/recurring-summary";
import { TrendChart } from "@/components/pro/trend-chart";

interface Insight { headline: string; points: readonly string[]; tips: readonly string[] }

export function DemoProPreview({ recurring, recurringTotal, trend, delta, insight }: { recurring: RecurringItem[]; recurringTotal: { count: number; monthlyTotal: KRW }; trend: TrendPoint[]; delta: MonthDelta; insight: Insight }) {
  return <div className="space-y-8">
    <div><h2 className="text-base font-semibold text-ink">Pro 기능 미리보기</h2><p className="mt-1 text-sm text-muted">정기 지출과 월별 변화, 지출 요약을 한곳에서 확인해요.</p></div>
    <section aria-labelledby="recurring-heading"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 id="recurring-heading" className="text-base font-semibold text-ink">정기결제</h3><RecurringSummary {...recurringTotal} /></div><RecurringList items={recurring} /></section>
    <section aria-labelledby="trend-heading"><h3 id="trend-heading" className="mb-3 text-base font-semibold text-ink">월별 추이</h3><TrendChart points={trend} /><div className="mt-4"><MonthComparison delta={delta} /></div></section>
    <section aria-labelledby="insight-heading"><h3 id="insight-heading" className="text-base font-semibold text-ink">지출 인사이트</h3><p className="mt-3 font-medium text-ink">{insight.headline}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-body">{insight.points.map((point) => <li key={point}>{point}</li>)}{insight.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul><p className="mt-3 text-sm text-muted">지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요.</p></section>
  </div>;
}
