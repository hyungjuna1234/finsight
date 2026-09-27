import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/domain/legal";

const sectionClass = "scroll-mt-4 space-y-3";
const headingClass = "text-base font-semibold text-ink";

export function TermsOfService() {
  return <>
    <section id="scope" className={sectionClass} aria-labelledby="scope-heading"><h2 id="scope-heading" className={headingClass}>서비스 범위</h2><p>FinSight는 사용자가 올린 카드 이용내역을 분류·요약해 화면에 표시해요.</p></section>
    <section id="not-advice" className={sectionClass} aria-labelledby="not-advice-heading"><h2 id="not-advice-heading" className={headingClass}>조언이 아님</h2><p>서비스 결과는 <strong>재무·투자·세무 조언이 아님</strong>을 알려 드려요. AI 요약에는 오류가 있을 수 있으므로 판단할 때는 원본 명세서를 기준으로 삼아 주세요.</p></section>
    <section id="account" className={sectionClass} aria-labelledby="account-heading"><h2 id="account-heading" className={headingClass}>계정과 탈퇴</h2><p>본인 계정으로 서비스를 이용해야 해요. 설정에서 데이터를 삭제하거나 탈퇴할 수 있고, 탈퇴하면 계정과 서비스 내 데이터가 삭제돼요.</p></section>
    <section id="paid" className={sectionClass} aria-labelledby="paid-heading"><h2 id="paid-heading" className={headingClass}>유료 서비스</h2><p>Pro는 월 단위 구독 서비스예요. 요금, 해지와 환불 조건은 <Link href="/refund" className="text-accent underline underline-offset-4">환불 정책</Link>에서 확인할 수 있어요.</p></section>
    <section id="prohibited" className={sectionClass} aria-labelledby="prohibited-heading"><h2 id="prohibited-heading" className={headingClass}>금지 행위</h2><ul className="list-disc space-y-2 pl-5"><li>타인의 카드 명세서를 허락 없이 업로드하는 행위</li><li>자동화된 대량 요청을 보내는 행위</li><li>서비스를 역설계하거나 보안 조치를 우회하는 행위</li><li>서비스 운영을 방해하는 행위</li></ul></section>
    <section id="liability" className={sectionClass} aria-labelledby="liability-heading"><h2 id="liability-heading" className={headingClass}>책임 제한</h2><p>관련 법령이 허용하는 범위에서, 사용자가 올린 자료의 오류나 AI 분류·요약의 오류로 생긴 손해에 대한 책임이 제한될 수 있어요.</p></section>
    <section id="changes" className={sectionClass} aria-labelledby="changes-heading"><h2 id="changes-heading" className={headingClass}>변경·중단</h2><p>운영상 필요한 경우 서비스나 약관을 변경하거나 서비스를 중단할 수 있어요. 중요한 변경은 적용 전에 서비스 화면으로 알려요.</p></section>
    <section id="law" className={sectionClass} aria-labelledby="law-heading"><h2 id="law-heading" className={headingClass}>준거법·분쟁</h2><p>[TODO: 준거법과 관할 법원 법률 검토]</p></section>
    <section id="business" className={sectionClass} aria-labelledby="business-heading"><h2 id="business-heading" className={headingClass}>사업자 정보</h2><p>{BUSINESS_INFO.name} · 대표자 {BUSINESS_INFO.owner} · 사업자등록번호 {BUSINESS_INFO.registrationNo} · 통신판매업 신고번호 {BUSINESS_INFO.mailOrderNo}</p><p>{BUSINESS_INFO.address} · {BUSINESS_INFO.email}</p></section>
  </>;
}
