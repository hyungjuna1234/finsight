import "server-only";

import { buildDashboardModel, resolveMonth, type DashboardModel } from "@/lib/analytics/dashboard";
import { kstToday, monthRange, monthsBetween } from "@/lib/domain/month";
import { requireConsent, requireUser } from "@/server/auth";
import { loadDataMonthSpan, loadTxViews } from "@/server/tx-rows";
import { createServerSupabase } from "@/services/supabase/server";

export type DashboardData = { state: "empty" } | ({ state: "ready" } & DashboardModel);

export async function getDashboard(month?: string): Promise<DashboardData> {
  const user = await requireUser();
  await requireConsent(user.id);
  const sb = await createServerSupabase();
  const span = await loadDataMonthSpan(sb, user.id);
  if (!span) return { state: "empty" };
  const availableMonths = monthsBetween(span.first, span.last).reverse();
  const selected = resolveMonth(month, availableMonths);
  const txs = await loadTxViews(sb, user.id, monthRange(selected));
  return { state: "ready", ...buildDashboardModel({ txs, month: selected, availableMonths, today: kstToday() }) };
}

export async function getHasTransactions(): Promise<boolean> {
  const user = await requireUser();
  await requireConsent(user.id);
  const sb = await createServerSupabase();
  return (await loadDataMonthSpan(sb, user.id)) !== null;
}
