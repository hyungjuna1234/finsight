import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ProTeasers } from "@/components/pro/pro-teasers";
import { getDashboard, getJourney, getProPanel } from "@/server/queries/dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const query = await searchParams;
  const data = await getDashboard(typeof query.month === "string" ? query.month : undefined);
  if (data.state === "empty") redirect("/upload");
  const panel = await getProPanel(data.month);
  const journey = await getJourney({ month: data.month, monthsWithData: data.availableMonths.length, staleMonth: data.uploadBannerMonth });
  return <DashboardView data={data} basePath="/dashboard" journey={journey} proTeasers={<ProTeasers panel={panel} primary={journey.primary === "pro_upgrade"} />} />;
}
