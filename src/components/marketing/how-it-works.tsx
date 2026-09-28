import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { ISSUER_GUIDES } from "@/lib/domain/guides";
import { LandingSection } from "./landing/landing-section";

const steps = [
  { title: "카드사 홈페이지에서", icon: <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></>, description: <>&apos;이용내역 조회&apos; 메뉴로 가요. 청구서가 아니라 <mark className="bg-mark px-[0.15em] font-semibold text-ink">이용내역</mark>이에요.</> },
  { title: "최근 3개월을 엑셀로 저장", icon: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M8 12h8M8 16h8M12 12v6" /></>, description: <>기간은 <mark className="bg-mark px-[0.15em] font-semibold text-ink">최근 3개월</mark>로 골라요. 석 달 치면 정기결제까지 찾아 드려요.</> },
  { title: "FinSight에 올리기", icon: <path d="M3 20h18M6 20v-6M11 20V8M16 20v-9M20 20V5" />, description: <>AI가 열을 맞추고 카테고리를 나눠요. 같은 형식은 다음부터 확인 없이 올라가요.</> },
] as const;

function StepIcon({ children }: { children: ReactNode }): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-ink">{children}</svg>;
}

export function HowItWorks(): JSX.Element {
  const issuerNames = ISSUER_GUIDES.map(({ name }) => name.replace(/카드$/, ""));

  return <LandingSection id="steps" tone="alt" labelledBy="how-heading">
    <p className="text-sm font-semibold text-accent">시작하는 법</p>
    <h2 id="how-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-4xl">3단계면 첫 대시보드를 볼 수 있어요</h2>
    <ol className="mt-9 grid gap-7 md:grid-cols-3 md:gap-8">
      {steps.map((step, index) => <li key={step.title} className="relative grid content-start gap-2">
        <div className="flex items-center gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-accent bg-surface text-sm font-bold text-accent tabular-nums">{index + 1}</span><StepIcon>{step.icon}</StepIcon></div>
        {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-[5.25rem] right-[-1.5rem] top-3.5 hidden border-t border-dashed border-line-strong md:block" /> : null}
        <h3 className="mt-1 text-[17px] font-bold text-ink">{step.title}</h3>
        <p className="text-sm leading-relaxed text-body">{step.description}</p>
      </li>)}
    </ol>
    <div className="mt-8 flex flex-wrap items-center gap-1.5">
      {issuerNames.map((name) => <span key={name} className="rounded border border-line bg-surface px-2.5 py-1 text-[13px] text-body">{name}</span>)}
      <Link href="/guide" className="ml-2 text-sm text-accent underline-offset-4 hover:underline">카드사별 받는 법 →</Link>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-muted">휴대폰만 있다면 PC에서 열 링크를 복사해 카카오톡 &apos;나와의 채팅&apos;에 붙여 두세요.</p>
  </LandingSection>;
}
