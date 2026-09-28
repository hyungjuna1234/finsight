import type { JSX } from "react";
import { LandingCta } from "./landing-cta";
import { LandingSection } from "./landing-section";

export function FinalCta(): JSX.Element {
  return <LandingSection id="final" tone="accent" labelledBy="final-heading">
    <h2 id="final-heading" className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">이번 달 지출, 파일 하나로 정리해 보세요</h2>
    <p className="mt-4 max-w-2xl text-base leading-relaxed text-accent-soft">연동 없이 카드사에서 받은 이용내역 파일만 있으면 돼요. 첫 AI 리포트는 무료예요.</p>
    <div className="mt-7 flex flex-wrap gap-3">
      <LandingCta href="/login?next=%2Fupload" cta="start" section="final" variant="invert">무료로 시작</LandingCta>
      <LandingCta href="/demo" cta="demo" section="final" variant="ghost">예시 먼저 보기</LandingCta>
    </div>
  </LandingSection>;
}
