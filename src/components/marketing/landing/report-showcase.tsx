import type { JSX, ReactNode } from "react";
import { AiDisclaimer } from "@/components/ui/ai-disclaimer";
import { CHAT_EXAMPLES } from "@/lib/domain/chat";
import { withTopic } from "@/lib/domain/korean";
import { formatKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";
import type { LandingShowcase } from "@/lib/demo/landing";
import { LandingSection } from "./landing-section";

function NumberMark({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{children}</span>;
}

function ReportBlock({ number, children }: { number: number; children: ReactNode }) {
  return <div className="relative">
    <span aria-hidden="true" className="absolute -left-7 top-0 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{number}</span>
    {children}
  </div>;
}

const explanations = [
  ["숫자는 FinSight가 직접 계산해요", "올린 거래를 서버에서 더하고 나눠요. AI는 숫자를 만들지 않아요."],
  ["문장은 AI가 써요", "숫자 없이 한 달 흐름만 설명해요. 숫자가 섞이면 다시 써요."],
  ["다음 달에 해 볼 일까지", "줄이기 쉬운 지출과 점검할 정기결제를 짚어 줘요."],
] as const;

export function ReportShowcase({ showcase }: { showcase: LandingShowcase }): JSX.Element {
  const month = formatMonthLabel(showcase.month, "short");
  const { content, netRate, weekendShare } = showcase.report;

  return <LandingSection id="report" labelledBy="report-heading">
    <p className="text-sm font-semibold text-accent">AI 리포트</p>
    <h2 id="report-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-4xl">숫자는 정확하게 계산하고, 설명은 AI가 쉽게 풀어 줘요</h2>
    <p className="mt-3 text-sm leading-relaxed text-body">첫 AI 리포트는 무료예요. Pro에서는 매달 리포트를 받고, 내 지출에 대해 채팅으로 물어볼 수 있어요.</p>

    <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-10">
      <article className="grid gap-[18px] rounded-md border border-line bg-surface p-5 pl-8 shadow-[0_18px_40px_-30px_rgba(24,32,28,0.4)]">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-bold text-ink">{month} AI 리포트</h3>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-body">예시</span>
        </header>

        <ReportBlock number={1}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2.5 rounded-md bg-bg p-3">
            <Metric label={`${month} 지출`}>{formatKRW(showcase.total)}</Metric>
            {netRate === null ? null : <Metric label="지난달보다" valueClassName={netRate > 0 ? "text-spend-up" : netRate < 0 ? "text-spend-down" : undefined}>{netRate > 0 ? "+" : ""}{netRate}%</Metric>}
            <Metric label="주말 비율">{weekendShare}%</Metric>
          </div>
        </ReportBlock>

        <ReportBlock number={2}>
          <p className="text-lg font-bold leading-relaxed text-ink">{content.headline}</p>
          <ul className="mt-2 grid list-disc gap-1 pl-[18px] text-sm leading-relaxed text-body">{content.points.map((point) => <li key={point}>{point}</li>)}</ul>
        </ReportBlock>

        <ReportBlock number={3}>
          <h4 className="text-sm font-semibold text-ink">실천 팁</h4>
          <ul className="mt-2 grid list-disc gap-1 pl-[18px] text-sm leading-relaxed text-body">{content.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </ReportBlock>

        <div className="border-t border-line pt-3"><AiDisclaimer /></div>
      </article>

      <div className="grid content-start gap-6">
        <ol aria-label="AI 리포트가 만들어지는 과정" className="grid gap-3.5">
          {explanations.map(([title, description], index) => <li key={title} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
            <NumberMark>{index + 1}</NumberMark>
            <div><strong className="block text-[15px] text-ink">{title}</strong><p className="mt-1 text-sm leading-relaxed text-body">{description}</p></div>
          </li>)}
        </ol>

        {showcase.chat ? <article aria-label="채팅 예시" className="overflow-hidden rounded-md border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5 text-sm font-semibold text-ink"><span>채팅</span><span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Pro</span></header>
          <div className="grid gap-2.5 p-3.5 text-sm leading-relaxed">
            <p className="max-w-[88%] justify-self-end rounded-[10px] rounded-br-[3px] bg-accent-soft px-3 py-2 text-ink">{showcase.chat.category === "카페·간식" ? "카페에 한 달에 얼마 써?" : `${showcase.chat.category}에 한 달에 얼마 써?`}</p>
            <p className="max-w-[88%] rounded-[10px] rounded-bl-[3px] bg-bg px-3 py-2 text-body">{month} {withTopic(showcase.chat.category)} <strong className="font-semibold text-ink tabular-nums">{formatKRW(showcase.chat.amount)}</strong>이에요. 가장 많이 간 곳은 {showcase.chat.topMerchant}, {showcase.chat.topMerchantCount}번이에요.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">{CHAT_EXAMPLES.slice(1, 3).map((example) => <span key={example} className="rounded-full border border-line px-2.5 py-1 text-xs text-accent">{example}</span>)}</div>
        </article> : null}
      </div>
    </div>
  </LandingSection>;
}

function Metric({ label, valueClassName, children }: { label: string; valueClassName?: string; children: ReactNode }) {
  return <div><p className="text-xs text-muted">{label}</p><p className={`mt-0.5 text-lg font-bold tracking-tight tabular-nums ${valueClassName ?? "text-ink"}`}>{children}</p></div>;
}
