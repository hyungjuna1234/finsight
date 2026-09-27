import Link from "next/link";
import { formatKRW } from "@/lib/domain/money";
import { PRO_MONTHLY_KRW } from "@/lib/domain/pricing";

export function PricingSummary() {
  return <section aria-labelledby="pricing-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="pricing-heading" className="text-base font-semibold text-ink">필요한 만큼 선택해요</h2><p className="mt-1 text-sm text-body">기본 지출 정리는 무료로 쓸 수 있어요.</p></div><Link href="/pricing" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">요금 자세히</Link></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-md border border-line bg-surface p-5"><h3 className="text-sm font-medium text-muted">Free</h3><p className="mt-2 text-lg font-semibold tabular-nums text-ink">₩0 · 업로드·분류·월별 대시보드</p></div>
      <div className="rounded-md border border-line bg-surface p-5"><h3 className="text-sm font-medium text-muted">Pro</h3><p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{formatKRW(PRO_MONTHLY_KRW)}/월</p><p className="mt-2 text-sm text-body">AI 리포트·Q&amp;A 채팅·추이·정기결제</p></div>
    </div>
    <p className="mt-3 text-sm text-muted">Pro 결제에는 해외결제 가능한 카드(VISA·Mastercard)가 필요해요.</p>
  </section>;
}
