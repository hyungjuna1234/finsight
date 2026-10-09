import "server-only";
import { buildInsightMetrics, type InsightContent } from "@/lib/analytics/insight-metrics";
import { summarizeMonth } from "@/lib/analytics/month";
import { detectRecurring, RECURRING_LOOKBACK_DAYS } from "@/lib/analytics/recurring";
import { AppError } from "@/lib/domain/errors";
import { addDays, kstToday, monthRange, prevMonth } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";
import { adminEntitlements } from "@/server/admin";
import { getPlan, requireConsent } from "@/server/auth";
import { withAiUsage } from "@/server/ai-usage";
import { assertDailyLimit } from "@/server/limits";
import { logger } from "@/server/logger";
import { loadTxViews } from "@/server/tx-rows";
import { writeInsight } from "@/services/claude/insight";
import { createServerSupabase } from "@/services/supabase/server";

export interface InsightView { month: YearMonth; content: InsightContent; createdAt: string }
export async function generateInsight(userId: string, month: YearMonth): Promise<InsightView> {
  await requireConsent(userId);
  const plan = await getPlan(userId);
  if (!plan.isPro && !plan.freeInsightAvailable) throw new AppError("PRO_REQUIRED");
  await assertDailyLimit(userId, "insight");
  const sb = await createServerSupabase();
  const currentRows = await loadTxViews(sb, userId, monthRange(month));
  const summary = summarizeMonth(currentRows, month);
  if (summary.count === 0) throw new AppError("NO_DATA");
  const previousMonth = prevMonth(month);
  const previousRows = await loadTxViews(sb, userId, monthRange(previousMonth));
  const today = kstToday(); const end = monthRange(month).to; const asOf = end < today ? end : today;
  const recurringRows = await loadTxViews(sb, userId, { from: addDays(asOf, -(RECURRING_LOOKBACK_DAYS - 1)), to: asOf });
  const metrics = buildInsightMetrics(summary, previousRows.length ? summarizeMonth(previousRows, previousMonth) : null, detectRecurring(recurringRows, asOf));
  const claimed = !plan.isPro;
  if (claimed && !(await adminEntitlements.markFreeInsightUsed(userId))) throw new AppError("PRO_REQUIRED");

  let content: InsightContent;
  let createdAt: string | undefined;
  try {
    const result = await withAiUsage(userId, "insight", () => writeInsight(metrics));
    content = result.content;
    const { data, error } = await sb.from("insights").upsert({ user_id: userId, month, content }, { onConflict: "user_id,month" }).select("created_at");
    if (error) throw new AppError("INTERNAL");
    createdAt = data?.[0]?.created_at;
  } catch (error) {
    if (claimed) {
      try {
        await adminEntitlements.releaseFreeInsight(userId);
      } catch (releaseError) {
        const code = releaseError instanceof AppError ? releaseError.code : "UNKNOWN";
        logger.warn("insight.credit_release_failed", { code });
      }
    }
    throw error;
  }
  return { month, content, createdAt: createdAt ?? new Date().toISOString() };
}
