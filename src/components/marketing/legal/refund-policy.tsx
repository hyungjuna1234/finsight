import { BUSINESS_INFO } from "@/lib/domain/legal";
import { formatKRW } from "@/lib/domain/money";
import { PRO_MONTHLY_KRW } from "@/lib/domain/pricing";

const sectionClass = "scroll-mt-4 space-y-3";
const headingClass = "text-base font-semibold text-ink";

export function RefundPolicy() {
  return <>
    <section id="subscription" className={sectionClass} aria-labelledby="subscription-heading"><h2 id="subscription-heading" className={headingClass}>구독과 해지</h2><p>Pro는 월 {formatKRW(PRO_MONTHLY_KRW)} 구독이며 Polar가 결제 화면의 표시 통화로 청구해요.</p><p>언제든 해지할 수 있어요. 해지하면 현재 결제 기간이 끝날 때까지 Pro를 이용하고, 그 뒤 Free로 전환돼요.</p></section>
    <section id="refund" className={sectionClass} aria-labelledby="refund-heading"><h2 id="refund-heading" className={headingClass}>환불 조건</h2><p><strong>결제 후 7일 이내에 Pro 기능(AI 리포트·채팅)을 사용하지 않았다면 전액 환불해요.</strong></p><p>환불은 판매 대행자(Merchant of Record)인 Polar를 통해 처리해요. 요청은 {BUSINESS_INFO.email}로 보내 주세요.</p></section>
    <section id="failed-payment" className={sectionClass} aria-labelledby="failed-payment-heading"><h2 id="failed-payment-heading" className={headingClass}>결제 실패</h2><p>결제에 실패하면 7일의 유예 기간 뒤 Free로 전환돼요.</p></section>
  </>;
}
