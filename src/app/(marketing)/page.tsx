import type { Metadata } from "next";
import { FAQ } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DataFlow } from "@/components/marketing/landing/data-flow";
import { FinalCta } from "@/components/marketing/landing/final-cta";
import { ReportShowcase } from "@/components/marketing/landing/report-showcase";
import { SectionViewTracker } from "@/components/marketing/landing/section-view-tracker";
import { SpendTiles } from "@/components/marketing/landing/spend-tiles";
import { PricingSummary } from "@/components/marketing/pricing-summary";
import { getLandingShowcase } from "@/lib/demo/landing";

export const metadata: Metadata = {
  title: "FinSight | 파일 하나로 보는 AI 지출 정리",
  description: "연동 없이 카드사 이용내역 파일만 올리면 AI가 카테고리를 나누고 새는 돈을 짚어 줘요.",
};

export default function LandingPage() {
  const showcase = getLandingShowcase();
  return <main><Hero showcase={showcase} /><SpendTiles showcase={showcase} /><ReportShowcase showcase={showcase} /><HowItWorks /><DataFlow /><PricingSummary /><FAQ /><FinalCta /><SectionViewTracker /></main>;
}
