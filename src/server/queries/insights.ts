import "server-only";
import { InsightContentSchema } from "@/lib/analytics/insight-metrics";
import { summarizeMonth, type MonthSummary } from "@/lib/analytics/month";
import { resolveMonth } from "@/lib/analytics/dashboard";
import { AppError } from "@/lib/domain/errors";
import { monthRange, monthsBetween } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";
import type { InsightView } from "@/server/actions/insights";
import { getPlan, requireConsent, requireUser, type ViewerPlan } from "@/server/auth";
import { loadDataMonthSpan, loadTxViews } from "@/server/tx-rows";
import { createServerSupabase } from "@/services/supabase/server";

export type InsightPageData = { state: "empty" } | { state: "ready"; month: YearMonth; availableMonths: YearMonth[]; summary: MonthSummary; insight: InsightView | null; plan: ViewerPlan };
export async function getInsightPage(month?: string): Promise<InsightPageData> {
  const user = await requireUser();
  await requireConsent(user.id);
  const sb = await createServerSupabase(); const span = await loadDataMonthSpan(sb, user.id);
  if (!span) return { state: "empty" };
  const availableMonths = monthsBetween(span.first, span.last).reverse(); const selected = resolveMonth(month, availableMonths);
  const rows = await loadTxViews(sb, user.id, monthRange(selected));
  const { data, error } = await sb.from("insights").select("month,content,created_at").eq("user_id", user.id).eq("month", selected).maybeSingle();
  if (error) throw new AppError("INTERNAL");
  let insight: InsightView | null = null;
  if (data) { const parsed = InsightContentSchema.safeParse(data.content); if (parsed.success) insight = { month: selected, content: parsed.data, createdAt: data.created_at }; }
  return { state: "ready", month: selected, availableMonths, summary: summarizeMonth(rows, selected), insight, plan: await getPlan(user.id) };
}
