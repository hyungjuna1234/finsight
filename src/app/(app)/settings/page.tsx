import { UploadHistory } from "@/components/upload/upload-history";
import { TypedConfirm } from "@/components/ui/typed-confirm";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { DELETE_ACCOUNT_PHRASE, DELETE_DATA_PHRASE } from "@/lib/domain/account";
import { getSettings, getSubscriptionSummary } from "@/server/queries/settings";

export default async function SettingsPage() {
  const [{ uploads, cards }, subscription] = await Promise.all([getSettings(), getSubscriptionSummary()]);
  return <div className="space-y-8"><h1 className="text-2xl font-semibold text-ink">설정</h1>
    <section><h2 className="text-base font-semibold text-ink">구독 관리</h2><SubscriptionPanel {...subscription} /></section>
    <section><h2 className="text-base font-semibold text-ink">카드</h2>{cards.length ? <ul className="mt-3 divide-y divide-line border-y border-line">{cards.map((card) => <li key={card.id} className="py-3 text-sm text-body">{card.name}</li>)}</ul> : <p className="mt-1 text-sm text-muted">등록한 카드가 없어요.</p>}</section>
    <section><h2 className="mb-3 text-base font-semibold text-ink">업로드 목록</h2><UploadHistory uploads={uploads} /></section>
    <TypedConfirm phrase={DELETE_DATA_PHRASE} title="데이터 삭제" description="올린 파일과 거래·분류·리포트를 모두 지워요. 계정과 구독은 그대로예요." submitLabel="전체 삭제" endpoint="/api/account/delete-data" redirectTo="/upload" />
    <TypedConfirm
      phrase={DELETE_ACCOUNT_PHRASE}
      title="탈퇴"
      description={<ul className="list-disc space-y-1 pl-5">
        <li>Pro 구독이 있으면 바로 해지돼요. 환불은 <a href="/refund" className="text-accent underline-offset-4 hover:underline">환불 정책</a>을 따라요.</li>
        <li>올린 원본 파일과 거래·분류·리포트가 모두 지워지고 되돌릴 수 없어요.</li>
        <li>결제 기록은 판매 대행자(Merchant of Record)인 Polar가 관련 법령에 따라 보관해요.</li>
      </ul>}
      submitLabel="탈퇴하기"
      endpoint="/api/account/delete"
      redirectTo="/"
      tone="danger"
      errorMessages={{ BILLING_UNAVAILABLE: "구독 해지에 실패해서 탈퇴를 멈췄어요. 잠시 후 다시 시도해 주세요." }}
    />
  </div>;
}
