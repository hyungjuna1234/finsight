import Link from "next/link";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DemoBanner } from "@/components/marketing/demo-banner";
import { DemoProPreview } from "@/components/marketing/demo-pro-preview";
import { DEMO_INSIGHT, getDemoDashboard, getDemoProPreview } from "@/lib/demo/fixtures";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const query = await searchParams;
  const data = getDemoDashboard(typeof query.month === "string" ? query.month : undefined);
  const proPreview = getDemoProPreview();
  return <>
    <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3"><Link href="/" className="text-base font-semibold text-ink">FinSight</Link><Link href="/login?next=%2Fupload" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">내 데이터로 시작</Link></div></header>
    <DemoBanner />
    <div className="mx-auto max-w-5xl px-4 py-8"><DashboardView data={data} basePath="/demo" showTransactionsLink={false} proTeasers={<DemoProPreview {...proPreview} insight={DEMO_INSIGHT} />} /></div>
  </>;
}
