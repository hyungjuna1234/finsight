import Link from "next/link";
import { formatKstDate } from "@/lib/domain/month";
import type { Plan } from "@/lib/domain/types";
import { PortalButton } from "./portal-button";

export function SubscriptionPanel({ plan, status, periodEnd, active }: { plan: Plan; status: string; periodEnd: string | null; active: boolean }) {
  if (!active || plan === "free") return <div className="mt-3"><p className="text-sm text-body">Free 플랜을 쓰고 있어요</p><Link href="/pricing" className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline">Pro 시작하기</Link></div>;
  return <div className="mt-3 space-y-3"><p className="text-sm text-body">{periodEnd ? `Pro · 현재 결제 기간 ${formatKstDate(new Date(periodEnd))}까지` : "Pro 플랜을 쓰고 있어요"}</p>{status === "past_due" ? <p className="text-sm text-warning">결제에 실패했어요. 기간이 끝나고 7일 안에 결제 수단을 바꿔 주세요.</p> : null}<PortalButton label="구독 관리" /></div>;
}
