import "server-only";

import { buildDashboardModel, resolveMonth, type DashboardModel } from "@/lib/analytics/dashboard";
import { summarizeMonth } from "@/lib/analytics/month";
import { detectRecurring, RECURRING_LOOKBACK_DAYS } from "@/lib/analytics/recurring";
import { buildFreePanel, buildProPanel, type ProPanel } from "@/lib/analytics/teasers";
import { addDays, kstToday, monthRange, monthsBetween, prevMonth } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";
import { getPlan, requireConsent, requireUser } from "@/server/auth";
import { hasTxInRange, loadDataMonthSpan, loadTxViews } from "@/server/tx-rows";
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

export async function getProPanel(month: YearMonth): Promise<ProPanel> {
  const user = await requireUser();
  await requireConsent(user.id);
  const plan = await getPlan(user.id);
  const sb = await createServerSupabase();
  const today = kstToday();
  const recurringRows = await loadTxViews(sb, user.id, { from: addDays(today, -(RECURRING_LOOKBACK_DAYS - 1)), to: today });
  const recurring = detectRecurring(recurringRows, today);
  const span = await loadDataMonthSpan(sb, user.id);
  const monthsWithData = span ? monthsBetween(span.first, span.last).length : 0;
  const previousMonth = prevMonth(month);
  if (!plan.isPro) {
    const previousHasData = await hasTxInRange(sb, user.id, monthRange(previousMonth));
    return buildFreePanel({ month, recurring, previousHasData, monthsWithData, freeInsightAvailable: plan.freeInsightAvailable });
  }
  const currentRows = await loadTxViews(sb, user.id, monthRange(month));
  const previousRows = await loadTxViews(sb, user.id, monthRange(previousMonth));
  return buildProPanel({ month, current: summarizeMonth(currentRows, month), previous: previousRows.length > 0 ? summarizeMonth(previousRows, previousMonth) : null, recurring });
}
