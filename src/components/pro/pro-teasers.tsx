import Link from "next/link";
import { TrackedLink } from "@/components/ui/tracked-link";
import type { ProPanel } from "@/lib/analytics/teasers";
import { ComparisonTeaser } from "./comparison-teaser";
import { MonthComparison } from "./month-comparison";
import { ProLock } from "./pro-lock";
import { RecurringSummary } from "./recurring-summary";
import { TrendTeaser } from "./trend-teaser";

export function ProTeasers({ panel, primary = false }: { panel: ProPanel; primary?: boolean }) {
  if (panel.kind === "pro") return <div className="space-y-8"><section><h2 className="mb-3 text-base font-semibold text-ink">정기결제</h2><RecurringSummary {...panel.recurring} href="/recurring" /></section>{panel.delta ? <MonthComparison delta={panel.delta} /> : null}<Link href="/trends" className="text-sm text-accent underline-offset-4 hover:underline">추이 보기</Link></div>;
  return <div className="space-y-8">{primary ? <section><p className="text-sm text-body">추이·전월 비교·정기결제 목록·AI 리포트를 매달 받아요</p><TrackedLink href="/pricing" event="next_step_click" eventProps={{ step: "pro_upgrade" }} className="mt-3 inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">Pro 시작하기</TrackedLink></section> : null}<section><h2 className="mb-3 text-base font-semibold text-ink">정기결제</h2>{panel.recurring ? <><RecurringSummary {...panel.recurring} /><ProLock from="recurring" variant="link" /></> : <p className="text-sm text-muted">석 달 이상 내역을 올리면 정기결제를 찾아 드려요.</p>}</section>{panel.comparisonLocked ? <ComparisonTeaser previousMonth={panel.comparisonLocked.previousMonth} /> : null}{panel.trendLocked ? <TrendTeaser variant="link" /> : null}<section><h3 className="text-base font-semibold text-ink">지출에 관해 물어보세요</h3><ul className="mt-3 space-y-2">{panel.chatExamples.map((example) => <li key={example}><Link href="/chat" className="text-sm text-accent underline-offset-4 hover:underline">{example}</Link></li>)}</ul></section></div>;
}
