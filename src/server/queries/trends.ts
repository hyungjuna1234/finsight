import "server-only";

import { compareMonths, monthlyTrend, type MonthDelta, type TrendPoint } from "@/lib/analytics/compare";
import { summarizeMonth } from "@/lib/analytics/month";
import { AppError } from "@/lib/domain/errors";
import { monthRange, monthsBetween } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";
import { requireConsent, requirePro, requireUser } from "@/server/auth";
import { loadDataMonthSpan, loadTxViews } from "@/server/tx-rows";
import { createServerSupabase } from "@/services/supabase/server";

export type TrendsData = { state: "empty" } | { state: "locked"; monthsWithData: number } | { state: "ready"; months: YearMonth[]; points: TrendPoint[]; delta: MonthDelta | null };

export async function getTrends(): Promise<TrendsData> {
  const user = await requireUser();
  await requireConsent(user.id);
  const sb = await createServerSupabase();
  const span = await loadDataMonthSpan(sb, user.id);
  if (!span) return { state: "empty" };
  const allMonths = monthsBetween(span.first, span.last);
  try { await requirePro(user.id); } catch (error) {
    if (error instanceof AppError && error.code === "PRO_REQUIRED") return { state: "locked", monthsWithData: allMonths.length };
    throw error;
  }
  const months = allMonths.slice(-12);
  const first = months[0];
  const last = months.at(-1);
  if (!first || !last) return { state: "empty" };
  const txs = await loadTxViews(sb, user.id, { from: monthRange(first).from, to: monthRange(last).to });
  const points = monthlyTrend(txs, months);
  const delta = months.length >= 2 ? compareMonths(summarizeMonth(txs, last), summarizeMonth(txs, months.at(-2)!)) : null;
  return { state: "ready", months, points, delta };
}
