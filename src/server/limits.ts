import "server-only";

import { AppError } from "@/lib/domain/errors";
import { kstToday } from "@/lib/domain/month";
import { logger } from "@/server/logger";
import type { AiFeature, ClaudeUsage } from "@/services/claude/models";
import { createServerSupabase } from "@/services/supabase/server";

export const DAILY_LIMITS = { uploads: 30, mapping: 30, classify: 100, insight: 10, chat: 30 } as const;
export type LimitKind = keyof typeof DAILY_LIMITS;

export function kstDayStart(now: Date = new Date()): string {
  return `${kstToday(now)}T00:00:00+09:00`;
}

export async function remainingDailyQuota(userId: string, kind: LimitKind, now = new Date()): Promise<number> {
  const supabase = await createServerSupabase();
  const result = kind === "uploads"
    ? await supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", kstDayStart(now))
    : await supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feature", kind).gte("created_at", kstDayStart(now));
  const { count, error } = result;
  if (error || count === null) throw new AppError("INTERNAL");
  return Math.max(0, DAILY_LIMITS[kind] - count);
}

export async function assertDailyLimit(userId: string, kind: LimitKind, now = new Date()): Promise<void> {
  if (await remainingDailyQuota(userId, kind, now) === 0) throw new AppError("RATE_LIMITED");
}

export async function recordAiUsage(userId: string, feature: AiFeature, usage: ClaudeUsage): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("ai_usage").insert({ user_id: userId, feature, model: usage.model, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens });
  if (error) logger.warn("ai_usage.insert_failed", { code: "DB_WRITE_FAILED" });
}
