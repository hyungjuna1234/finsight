import Link from "next/link";

const itemClassName = "border-b border-line py-4";
const summaryClassName = "cursor-pointer text-sm font-medium text-ink";
const answerClassName = "mt-3 text-sm leading-relaxed text-body";

export function FAQ() {
  return <section aria-labelledby="faq-heading">
    <h2 id="faq-heading" className="text-base font-semibold text-ink">자주 묻는 질문</h2>
    <div className="mt-2 border-t border-line">
      <details className={itemClassName}><summary className={summaryClassName}>어떤 카드사를 지원하나요?</summary><p className={answerClassName}>신한·삼성·현대·KB국민·롯데·하나 홈페이지의 이용내역 CSV·엑셀을 지원해요. 형식이 비슷하면 다른 카드사도 대부분 돼요.</p></details>
      <details className={itemClassName}><summary className={summaryClassName}>파일은 어디서 받나요?</summary><p className={answerClassName}>카드사별 자세한 방법은 <Link href="/guide" className="text-accent underline-offset-4 hover:underline">가이드</Link>에서 확인해 주세요.</p></details>
      <details className={itemClassName}><summary className={summaryClassName}>어떤 카드로 결제할 수 있나요?</summary><p className={answerClassName}>해외결제 가능한 VISA·Mastercard가 필요해요. 국내전용 카드는 결제되지 않아요.</p></details>
      <details className={itemClassName}><summary className={summaryClassName}>데이터를 직접 삭제할 수 있나요?</summary><p className={answerClassName}>설정에서 업로드별 삭제·전체 삭제·탈퇴를 할 수 있어요. 원본은 90일 후 자동 삭제돼요.</p></details>
      <details className={itemClassName}><summary className={summaryClassName}>투자 조언도 해 주나요?</summary><p className={answerClassName}>아니요. 지출 정리를 돕는 요약이고 재무·투자·세무 조언을 하지 않아요.</p></details>
    </div>
  </section>;
}
