import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardModel } from "@/lib/analytics/dashboard";
import { CategoryChart } from "./category-chart";
import { MonthPicker } from "./month-picker";
import { SummaryTiles } from "./summary-tiles";
import { TopMerchants } from "./top-merchants";
import { UploadBanner } from "./upload-banner";

export function DashboardView({ data, basePath, proTeasers }: { data: DashboardModel; basePath: string; proTeasers?: ReactNode }) {
  return <main className="space-y-8">
    {data.uploadBannerMonth ? <UploadBanner month={data.uploadBannerMonth} /> : null}
    <div><h1 className="mb-4 text-2xl font-semibold text-ink">대시보드</h1><MonthPicker month={data.month} availableMonths={data.availableMonths} basePath={basePath} /></div>
    <SummaryTiles summary={data.summary} />
    {data.summary.count === 0 ? <p className="py-8 text-sm text-muted">이 달에는 거래가 없어요</p> : <>
      <section aria-labelledby="category-heading"><h2 id="category-heading" className="mb-3 text-base font-semibold text-ink">카테고리별 지출</h2><CategoryChart items={data.summary.byCategory} /></section>
      <section aria-labelledby="merchant-heading"><h2 id="merchant-heading" className="mb-3 text-base font-semibold text-ink">TOP5 가맹점</h2><TopMerchants items={data.summary.topMerchants} /></section>
    </>}
    <Link href={`/transactions?month=${data.month}`} className="text-sm text-accent underline-offset-4 hover:underline">거래 전체 보기</Link>
    {proTeasers ? <section aria-label="Pro 미리보기">{proTeasers}</section> : null}
  </main>;
}
