import Link from "next/link";
import { CheckoutButton } from "./checkout-button";
import { PortalButton } from "./portal-button";
import { formatKRW } from "@/lib/domain/money";
import { PLAN_FEATURES, PRO_BASE_PRICE_LABEL, PRO_MONTHLY_KRW } from "@/lib/domain/pricing";
import type { Plan } from "@/lib/domain/types";

export function PricingTable({ viewer, checkoutFailed }: { viewer: "anonymous" | Plan; checkoutFailed: boolean }) {
  return <div className="space-y-8">
    {checkoutFailed ? <p role="alert" className="rounded-md border border-line bg-surface p-4 text-sm text-warning">결제가 완료되지 않았어요. 국내전용 카드는 결제가 안 돼요. 해외결제 가능한 카드로 다시 시도해 주세요.</p> : null}
    <section className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-line"><th className="py-3 pr-4 font-medium text-muted">기능</th><th className="px-4 py-3 font-medium text-ink">Free</th><th className="px-4 py-3 font-medium text-ink">Pro</th></tr></thead><tbody>{PLAN_FEATURES.map((feature) => <tr key={feature.label} className="border-b border-line"><th scope="row" className="py-3 pr-4 font-medium text-body">{feature.label}</th><td className="px-4 py-3 text-muted">{feature.free}</td><td className="px-4 py-3 text-ink">{feature.pro}</td></tr>)}</tbody></table></section>
    <section className="rounded-md border border-line bg-surface p-5"><p className="text-sm font-medium text-muted">Pro</p><p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{formatKRW(PRO_MONTHLY_KRW)}/월</p><p className="mt-1 text-sm text-muted">(기본 통화 {PRO_BASE_PRICE_LABEL}, Polar가 접속 위치에 따라 원화로 표시해요)</p><p className="mt-5 text-sm text-body">해외결제가 가능한 카드(VISA·Mastercard)가 필요해요. 국내전용 카드는 결제되지 않아요.</p><p className="mt-2 text-sm text-body">언제든 해지할 수 있고, 해지해도 결제한 기간 끝까지 Pro를 쓸 수 있어요. <Link href="/refund" className="text-accent underline-offset-4 hover:underline">환불 정책</Link></p><div className="mt-5">{viewer === "anonymous" ? <Link href="/login?next=%2Fpricing" className="inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">로그인하고 Pro 시작하기</Link> : viewer === "free" ? <CheckoutButton returnTo="/dashboard" /> : <div className="space-y-3"><p className="text-sm text-body">이미 Pro를 쓰고 있어요</p><PortalButton /></div>}</div></section>
  </div>;
}
