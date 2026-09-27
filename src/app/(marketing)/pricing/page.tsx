import type { Metadata } from "next";
import { PricingTable } from "@/components/billing/pricing-table";
import { getOptionalPlan } from "@/server/auth";

export const metadata: Metadata = { title: "요금" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string | string[] }> }) {
  const [viewer, query] = await Promise.all([getOptionalPlan(), searchParams]);
  return <main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-2xl font-semibold text-ink">요금</h1><p className="mt-2 text-sm text-body">필요한 지출 정리는 무료로, 더 깊은 분석은 Pro로 이용해요.</p><div className="mt-8"><PricingTable viewer={viewer} checkoutFailed={query.checkout === "failed"} /></div></main>;
}
