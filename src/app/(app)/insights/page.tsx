import { redirect } from "next/navigation";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { SummaryTiles } from "@/components/dashboard/summary-tiles";
import { GenerateInsightButton } from "@/components/pro/generate-insight-button";
import { InsightCard } from "@/components/pro/insight-card";
import { InsightFeedback } from "@/components/pro/insight-feedback";
import { ProLock } from "@/components/pro/pro-lock";
import { getInsightPage } from "@/server/queries/insights";
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) { const query = await searchParams; const data = await getInsightPage(typeof query.month === "string" ? query.month : undefined); if (data.state === "empty") redirect("/upload"); return <div className="space-y-8"><div><h1 className="text-2xl font-semibold text-ink">AI 지출 리포트</h1><div className="mt-4"><MonthPicker month={data.month} availableMonths={data.availableMonths} basePath="/insights" /></div></div><SummaryTiles summary={data.summary} /><div className="grid gap-6 md:grid-cols-2"><section><h2 className="mb-3 text-base font-semibold text-ink">카테고리별 지출</h2><CategoryChart items={data.summary.byCategory} /></section><section><h2 className="mb-3 text-base font-semibold text-ink">지출 인사이트</h2>{data.insight ? <><InsightCard content={data.insight.content} /><InsightFeedback />{data.plan.isPro ? <div className="mt-3"><GenerateInsightButton month={data.month} label="다시 만들기" free={!data.plan.isPro} /></div> : null}</> : data.plan.isPro || data.plan.freeInsightAvailable ? <GenerateInsightButton month={data.month} label={data.plan.isPro ? "리포트 만들기" : "첫 리포트 무료로 만들기"} free={!data.plan.isPro} /> : <ProLock message="Pro에서 매달 AI 리포트를 받을 수 있어요" from="insight" />}</section></div></div>; }
