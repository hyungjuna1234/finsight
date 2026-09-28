import type { Metadata } from "next";
import { FAQ } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSummary } from "@/components/marketing/pricing-summary";
import { TrustPoints } from "@/components/marketing/trust-points";
import { getLandingShowcase } from "@/lib/demo/landing";

export const metadata: Metadata = {
  title: "FinSight | 카드 이용내역으로 보는 한 달 지출",
  description: "연동 없이 카드사 이용내역 파일만 올리면 한 달 지출을 분류하고 요약해 드려요.",
};

export default function LandingPage() {
  return <main className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-16"><Hero showcase={getLandingShowcase()} /><TrustPoints /><HowItWorks /><PricingSummary /><FAQ /></main>;
}
