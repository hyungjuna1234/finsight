import type { LandingShowcase } from "@/lib/demo/landing";
import { HeroStage } from "./landing/hero-stage";
import { LandingCta } from "./landing/landing-cta";
import { LandingSection } from "./landing/landing-section";

export function Hero({ showcase }: { showcase: LandingShowcase }) {
  return <LandingSection id="hero" labelledBy="hero-heading">
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] lg:items-center lg:gap-14">
      <div>
        <p className="text-sm font-semibold text-accent">연동 없는 AI 지출 정리</p>
        <h1 id="hero-heading" className="mt-2.5 text-[2rem] leading-[1.18] font-bold tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem]">월급이 <mark className="bg-[linear-gradient(transparent_60%,var(--color-mark)_60%,var(--color-mark)_94%,transparent_94%)] text-inherit">어디로 새는지</mark>, 파일 하나로 AI가 찾아 드려요</h1>
        <p className="mt-4.5 max-w-[30em] text-base leading-relaxed text-body sm:text-lg">카드사 홈페이지에서 받은 이용내역 파일만 올리면, AI가 카테고리를 나누고 새는 돈을 짚어 줘요.</p>
        <div className="mt-7 flex flex-wrap gap-2.5"><LandingCta href="/login?next=%2Fupload" cta="start" section="hero" variant="primary">무료로 시작</LandingCta><LandingCta href="/demo" cta="demo" section="hero" variant="secondary">로그인 없이 예시 보기</LandingCta></div>
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">{["계좌·카드 연동 없음", "원본은 90일 뒤 자동 삭제", "첫 AI 리포트 무료"].map((item) => <li key={item} className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />{item}</li>)}</ul>
      </div>
      <HeroStage month={showcase.month} total={showcase.total} count={showcase.count} rows={showcase.sheetRows} bars={showcase.categoryBars} insight={{ headline: showcase.report.content.headline, increase: showcase.increase }} />
    </div>
  </LandingSection>;
}
