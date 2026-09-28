import Link from "next/link";
import type { ReactNode } from "react";
import { formatKRW } from "@/lib/domain/money";
import { PRO_MONTHLY_KRW } from "@/lib/domain/pricing";
import { LandingSection } from "./landing/landing-section";

function CheckItem({ children, highlighted = false }: { children: ReactNode; highlighted?: boolean }) {
  return <li className={`flex items-start gap-2 ${highlighted ? "-mx-2 rounded-md bg-accent-soft px-2 py-1 font-semibold text-ink" : "text-body"}`}>
    <svg aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
    <span>{children}</span>
  </li>;
}

export function PricingSummary() {
  return <LandingSection id="pricing" tone="alt" labelledBy="pricing-heading">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold text-accent">요금</p><h2 id="pricing-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-4xl">지출 정리는 무료, 더 깊은 분석은 Pro</h2></div>
      <Link href="/pricing" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">요금 자세히</Link>
    </div>
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <article className="rounded-md border border-line bg-bg p-6">
        <h3 className="text-sm font-bold text-muted">Free</h3>
        <p className="mt-2 text-4xl font-bold tracking-tight text-ink tabular-nums">₩0</p>
        <ul className="mt-5 grid gap-2 text-sm leading-relaxed">
          <CheckItem>업로드와 AI 자동 분류</CheckItem><CheckItem>월별 대시보드</CheckItem><CheckItem>정기결제 건수와 합계</CheckItem><CheckItem highlighted>첫 AI 리포트 1회 무료</CheckItem>
        </ul>
      </article>
      <article className="rounded-md border border-ink bg-surface p-6">
        <h3 className="text-sm font-bold text-muted">Pro</h3>
        <p className="mt-2 flex items-baseline text-4xl font-bold tracking-tight text-ink tabular-nums">{formatKRW(PRO_MONTHLY_KRW)}<span className="ml-0.5 text-sm font-semibold text-muted">/월</span></p>
        <ul className="mt-5 grid gap-2 text-sm leading-relaxed">
          <CheckItem>매달 AI 리포트</CheckItem><CheckItem>내 지출에 대해 채팅으로 묻기</CheckItem><CheckItem>여러 달 추이와 전월 비교</CheckItem><CheckItem>정기결제 전체 목록</CheckItem>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted">해외결제가 되는 카드(VISA·Mastercard)가 필요해요. 언제든 해지할 수 있어요.</p>
      </article>
    </div>
  </LandingSection>;
}
