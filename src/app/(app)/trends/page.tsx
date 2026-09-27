import { redirect } from "next/navigation";
import { MonthComparison } from "@/components/pro/month-comparison";
import { TrendChart } from "@/components/pro/trend-chart";
import { TrendTeaser } from "@/components/pro/trend-teaser";
import { getTrends } from "@/server/queries/trends";

export default async function TrendsPage() {
  const data = await getTrends();
  if (data.state === "empty") redirect("/upload");
  return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">월별 추이</h1>{data.state === "locked" ? <><p className="text-sm text-muted">{data.monthsWithData}개월의 변화가 준비됐어요.</p><TrendTeaser /></> : <><TrendChart points={data.points} />{data.delta ? <MonthComparison delta={data.delta} /> : null}</>}</main>;
}
