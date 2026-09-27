import { BUSINESS_INFO } from "@/lib/domain/legal";

const sectionClass = "scroll-mt-4 space-y-3";
const headingClass = "text-base font-semibold text-ink";
const listClass = "list-disc space-y-2 pl-5";

export function PrivacyPolicy() {
  return <>
    <section id="items" className={sectionClass} aria-labelledby="items-heading">
      <h2 id="items-heading" className={headingClass}>수집하는 개인정보</h2>
      <ul className={listClass}>
        <li><strong>로그인:</strong> 카카오·구글 계정 식별자와 이메일(제공되는 경우)</li>
        <li><strong>업로드:</strong> 카드 이용내역 파일과 파일에서 추출한 이용일, 가맹점명, 금액, 할부, 승인번호, 카드번호 끝 4자리. 카드번호는 끝 4자리만 저장해요.</li>
        <li><strong>결제:</strong> 구독 상태와 기간. 카드 정보는 Polar가 직접 받아요.</li>
        <li><strong>자동 수집:</strong> 접속 기록과 쿠키 없는 방문 통계(Vercel Web Analytics)</li>
      </ul>
    </section>

    <section id="purpose" className={sectionClass} aria-labelledby="purpose-heading">
      <h2 id="purpose-heading" className={headingClass}>이용 목적</h2>
      <p>지출 분류·요약, Pro 기능 제공, 결제·구독 관리, 서비스 남용 방지에 이용해요.</p>
    </section>

    <section id="retention" className={sectionClass} aria-labelledby="retention-heading">
      <h2 id="retention-heading" className={headingClass}>보유 기간</h2>
      <ul className={listClass}>
        <li>원본 파일은 올린 뒤 <strong>90일</strong>에 자동 삭제해요.</li>
        <li>거래·분류 결과는 사용자가 삭제할 때까지 보관해요.</li>
        <li><strong>탈퇴하면 즉시 삭제해요.</strong></li>
        <li>결제 기록은 Polar가 관련 법령에 따라 보관해요.</li>
      </ul>
    </section>

    <section id="overseas" className={sectionClass} aria-labelledby="overseas-heading">
      <h2 id="overseas-heading" className={headingClass}>개인정보의 국외 이전</h2>
      <div className="overflow-x-auto">
        <table aria-label="개인정보 국외 이전 내역" className="w-full min-w-4xl border-collapse text-left text-sm">
          <thead><tr className="border-y border-line bg-bg">
            {['이전받는 자', '국가', '항목', '목적', '시기와 방법', '보유 기간'].map((label) => <th key={label} scope="col" className="p-3 font-medium text-ink">{label}</th>)}
          </tr></thead>
          <tbody className="align-top">
            <tr className="border-b border-line"><th scope="row" className="p-3 font-medium text-ink">Anthropic PBC</th><td className="p-3">미국</td><td className="p-3">가맹점명, 월별 집계값, 마스킹된 표 샘플(헤더+5행), 채팅 질문</td><td className="p-3">AI 분류·요약·답변</td><td className="p-3">기능을 쓸 때 API로 전송</td><td className="p-3">Anthropic API 데이터 보존 정책에 따름 [TODO: 정책 링크·기간 확인]</td></tr>
            <tr className="border-b border-line"><th scope="row" className="p-3 font-medium text-ink">Polar (법인명 [TODO: 확인])</th><td className="p-3">미국</td><td className="p-3">이메일, 결제 정보</td><td className="p-3">결제·구독 관리(판매 대행)</td><td className="p-3">결제할 때</td><td className="p-3">관련 법령에 따른 기간</td></tr>
            <tr className="border-b border-line"><th scope="row" className="p-3 font-medium text-ink">Vercel Inc.</th><td className="p-3">미국</td><td className="p-3">접속 기록과 요청 처리 데이터</td><td className="p-3">호스팅</td><td className="p-3">서비스를 쓸 때</td><td className="p-3">[TODO: 확인]</td></tr>
          </tbody>
        </table>
      </div>
      <p>데이터베이스·파일은 Supabase 서울 리전(대한민국)에 저장해요.</p>
      <p>국외 이전에 동의하지 않으면 서비스를 이용할 수 없어요. 동의를 철회하려면 탈퇴해 주세요.</p>
    </section>

    <section id="processors" className={sectionClass} aria-labelledby="processors-heading"><h2 id="processors-heading" className={headingClass}>처리 위탁</h2><ul className={listClass}><li>Supabase: 인증·데이터베이스·파일 저장(서울 리전)</li><li>Vercel: 호스팅</li><li>Anthropic: AI 처리</li><li>Polar: 결제</li></ul></section>
    <section id="rights" className={sectionClass} aria-labelledby="rights-heading"><h2 id="rights-heading" className={headingClass}>권리 행사</h2><p>설정에서 개인정보를 열람하고, 업로드 삭제·전체 삭제·탈퇴를 할 수 있어요. 그 밖의 요청은 {BUSINESS_INFO.email}로 보내 주세요.</p></section>
    <section id="destruction" className={sectionClass} aria-labelledby="destruction-heading"><h2 id="destruction-heading" className={headingClass}>파기 절차</h2><p>보유 기간이 끝나거나 삭제 요청을 받으면 대상 데이터를 확인해 복구하기 어렵도록 삭제해요. 원본 파일은 자동 삭제 일정에 따라 비공개 저장소에서 삭제해요.</p></section>
    <section id="security" className={sectionClass} aria-labelledby="security-heading"><h2 id="security-heading" className={headingClass}>안전성 확보 조치</h2><ul className={listClass}><li>전송 구간을 암호화해요.</li><li>RLS로 본인 데이터에만 접근하도록 제한해요.</li><li>파일은 비공개 저장소에 보관해요.</li><li>로그에 거래 내용을 남기지 않아요.</li><li>세션 쿠키에 httpOnly를 적용해요.</li></ul></section>
    <section id="officer" className={sectionClass} aria-labelledby="officer-heading"><h2 id="officer-heading" className={headingClass}>개인정보 보호책임자</h2><p>{BUSINESS_INFO.privacyOfficer} · 문의 {BUSINESS_INFO.email}</p></section>
  </>;
}
