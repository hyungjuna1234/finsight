import { UploadHistory } from "@/components/upload/upload-history";
import { TypedConfirm } from "@/components/ui/typed-confirm";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { DELETE_DATA_PHRASE } from "@/lib/domain/account";
import { getSettings, getSubscriptionSummary } from "@/server/queries/settings";

export default async function SettingsPage() {
  const [{ uploads, cards }, subscription] = await Promise.all([getSettings(), getSubscriptionSummary()]);
  return <div className="space-y-8"><h1 className="text-2xl font-semibold text-ink">설정</h1>
    <section><h2 className="text-base font-semibold text-ink">구독 관리</h2><SubscriptionPanel {...subscription} /></section>
    <section><h2 className="text-base font-semibold text-ink">카드</h2>{cards.length ? <ul className="mt-3 divide-y divide-line border-y border-line">{cards.map((card) => <li key={card.id} className="py-3 text-sm text-body">{card.name}</li>)}</ul> : <p className="mt-1 text-sm text-muted">등록한 카드가 없어요.</p>}</section>
    <section><h2 className="mb-3 text-base font-semibold text-ink">업로드 목록</h2><UploadHistory uploads={uploads} /></section>
    <TypedConfirm phrase={DELETE_DATA_PHRASE} title="데이터 삭제" description="올린 파일과 거래·분류·리포트를 모두 지워요. 계정과 구독은 그대로예요." submitLabel="전체 삭제" endpoint="/api/account/delete-data" redirectTo="/upload" />
    <section><h2 className="text-base font-semibold text-ink">탈퇴</h2><p className="mt-1 text-sm text-body">탈퇴 기능은 곧 열려요.</p></section>
  </div>;
}
