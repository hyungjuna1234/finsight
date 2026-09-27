import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/marketing/copy-link-button";
import { IssuerGuideList } from "@/components/marketing/issuer-guide-list";
import { TroubleshootingList } from "@/components/marketing/troubleshooting-list";
import { ISSUER_GUIDES, TROUBLESHOOTING } from "@/lib/domain/guides";

export const metadata: Metadata = { title: "카드 이용내역 받는 법" };

export default function GuidePage() {
  return <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 pb-16">
    <h1 className="text-2xl font-semibold text-ink">카드 이용내역 받는 법</h1>

    <section id="why" aria-labelledby="why-heading" className="scroll-mt-4">
      <h2 id="why-heading" className="text-base font-semibold text-ink">왜 &apos;이용내역&apos;인가요?</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-body">
        <p>청구서(명세서)는 결제일 기준 묶음이라 할부·취소가 나뉘어 보여요.</p>
        <p>이용내역은 쓴 날짜·가맹점·금액이 한 줄씩 있어서 정리가 정확해요.</p>
      </div>
    </section>

    <section id="issuers" aria-labelledby="issuers-heading" className="scroll-mt-4">
      <h2 id="issuers-heading" className="text-base font-semibold text-ink">카드사별 받는 법 (PC 웹)</h2>
      <div className="mt-3"><IssuerGuideList guides={ISSUER_GUIDES} /></div>
    </section>

    <section id="mobile" aria-labelledby="mobile-heading" className="scroll-mt-4">
      <h2 id="mobile-heading" className="text-base font-semibold text-ink">휴대폰만 있다면</h2>
      <div className="mt-3 space-y-3">
        <p className="text-sm leading-relaxed text-body">카드사 앱에서는 엑셀로 저장하기 어려워요. PC에서 이어서 해 주세요.</p>
        <CopyLinkButton path="/upload" label="PC에서 열 링크 복사" />
        <p className="text-sm leading-relaxed text-body">카카오톡 &apos;나와의 채팅&apos;에 붙여 두면 PC에서 바로 열 수 있어요.</p>
      </div>
    </section>

    <section id="trouble" aria-labelledby="trouble-heading" className="scroll-mt-4">
      <h2 id="trouble-heading" className="text-base font-semibold text-ink">올리다가 막히면</h2>
      <div className="mt-3"><TroubleshootingList items={TROUBLESHOOTING} /></div>
    </section>

    <Link href="/login?next=%2Fupload" className="inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">무료로 시작</Link>
  </main>;
}
