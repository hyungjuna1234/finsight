import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DemoBanner } from "@/components/marketing/demo-banner";
import { DemoProPreview } from "@/components/marketing/demo-pro-preview";
import { DEMO_INSIGHT, getDemoDashboard, getDemoProPreview } from "@/lib/demo/fixtures";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const query = await searchParams;
  const data = getDemoDashboard(typeof query.month === "string" ? query.month : undefined);
  const proPreview = getDemoProPreview();
  return <>
    <DemoBanner />
    <div className="mx-auto max-w-5xl px-4 py-8"><DashboardView data={data} basePath="/demo" showTransactionsLink={false} proTeasers={<DemoProPreview {...proPreview} insight={DEMO_INSIGHT} />} /></div>
  </>;
}
