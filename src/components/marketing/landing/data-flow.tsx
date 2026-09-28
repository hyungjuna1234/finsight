import type { JSX, ReactNode } from "react";
import { LandingSection } from "./landing-section";

const sentData = [["열 맞추기", "가린 샘플 5행"], ["카테고리 분류", "가맹점명"], ["AI 리포트", "합계·비율 같은 집계값"]] as const;

function Arrow(): JSX.Element {
  return <div aria-hidden="true" className="grid place-items-center text-line-strong"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[22px] rotate-90 lg:rotate-0"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>;
}

function CheckItem({ children }: { children: ReactNode }): JSX.Element {
  return <li className="flex items-start gap-2"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0 text-accent"><path d="M5 12l5 5L20 7" /></svg><span>{children}</span></li>;
}

function Cross(): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3.5 shrink-0 text-spend-up"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

export function DataFlow(): JSX.Element {
  return <LandingSection id="trust" labelledBy="trust-heading">
    <p className="text-sm font-semibold text-accent">데이터</p>
    <h2 id="trust-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-4xl">AI에는 기능에 필요한 만큼만 보내요</h2>
    <div className="mt-9 grid items-stretch gap-2.5 lg:grid-cols-[.8fr_auto_.9fr_auto_1.3fr]">
      <div className="rounded-md border border-line bg-surface px-[18px] py-4">
        <h3 className="text-sm font-bold text-ink">내 이용내역 파일</h3>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[13px] text-body">{["이용일", "가맹점", "금액"].map((field) => <li key={field} className="rounded bg-bg px-2.5 py-1">{field}</li>)}{["카드번호", "승인번호"].map((field) => <li key={field} className="rounded bg-[#F7E7E4] px-2.5 py-1 text-[#8A2A20]">{field}</li>)}</ul>
      </div>
      <Arrow />
      <div className="rounded-md border border-line bg-surface px-[18px] py-4">
        <h3 className="flex items-baseline gap-2 text-sm font-bold text-ink">FinSight 서버 <span className="text-xs font-medium text-muted">서울 리전</span></h3>
        <ul className="mt-3 grid gap-2 text-[13.5px] leading-relaxed text-body"><CheckItem>카드번호와 긴 숫자를 가려요</CheckItem><CheckItem>합계와 비율은 여기서 계산해요</CheckItem><CheckItem>원본 파일은 여기에만 있어요</CheckItem></ul>
      </div>
      <Arrow />
      <div className="rounded-md border-[1.5px] border-ink bg-surface px-[18px] py-4">
        <h3 className="text-sm font-bold text-ink">AI에 보내는 것</h3>
        <table className="mt-2.5 w-full border-collapse text-[13.5px]"><tbody>
          {sentData.map(([feature, data]) => <tr key={feature} className="border-b border-line"><th scope="row" className="w-[42%] whitespace-nowrap py-2 pr-2.5 text-left font-semibold text-ink">{feature}</th><td className="py-2 text-body">{data}</td></tr>)}
          <tr><th scope="row" className="w-[42%] whitespace-nowrap py-2 pr-2.5 text-left font-semibold text-ink">채팅 <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">Pro</span></th><td className="py-2 text-body">질문과, 답에 필요한 거래 30건 이하(날짜·가맹점·금액)</td></tr>
        </tbody></table>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm"><p className="font-semibold text-ink">AI에 보내지 않아요</p><ul className="flex flex-wrap gap-x-3.5 gap-y-2 text-body">{["카드번호", "이름·이메일", "원본 파일"].map((item) => <li key={item} className="inline-flex items-center gap-1.5"><Cross />{item}</li>)}</ul></div>
    <div className="mt-9 max-w-2xl">
      <div className="relative flex h-10 items-start justify-between border-b-2 border-ink text-[13px] font-semibold text-ink"><span>올린 날</span><span>90일 · 원본 자동 삭제</span><span aria-hidden="true" className="absolute -bottom-1.5 left-0 size-2.5 rounded-full bg-ink" /><span aria-hidden="true" className="absolute -bottom-1.5 right-0 size-2.5 rounded-full border-2 border-ink bg-surface" /></div>
      <p className="mt-3.5 text-sm leading-relaxed text-body">그 전에도 언제든 업로드별 삭제, 전체 삭제, 탈퇴를 할 수 있어요.</p>
    </div>
  </LandingSection>;
}
