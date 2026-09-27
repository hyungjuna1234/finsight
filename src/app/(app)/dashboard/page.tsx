import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboard } from "@/server/queries/dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const query = await searchParams;
  const data = await getDashboard(typeof query.month === "string" ? query.month : undefined);
  if (data.state === "empty") redirect("/upload");
  return <DashboardView data={data} basePath="/dashboard" />;
}
