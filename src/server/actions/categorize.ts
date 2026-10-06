import "server-only";

import { DEFAULT_CATEGORY, isCategory, type Category } from "@/lib/domain/categories";
import { AppError } from "@/lib/domain/errors";
import type { CategorySource } from "@/lib/domain/types";
import { categorizeByRule } from "@/lib/ingest/rules";
import { recordAiUsage, remainingDailyQuota } from "@/server/limits";
import { logger } from "@/server/logger";
import { classify } from "@/services/claude/classifier";
import { createServerSupabase } from "@/services/supabase/server";

export interface CategorizeResult {
  byKey: Map<string, { category: Category; source: CategorySource }>;
  aiFailed: boolean;
  rateLimited: boolean;
}

const BATCH_SIZE = 100;

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE));
  }
  return result;
}

export async function categorizeTransactions(
  userId: string,
  rows: { merchantKey: string }[],
): Promise<CategorizeResult> {
  const keys = [...new Set(rows.map(({ merchantKey }) => merchantKey))];
  const byKey = new Map<string, { category: Category; source: CategorySource }>();
  const supabase = await createServerSupabase();

  for (const chunk of batches(keys)) {
    const { data, error } = await supabase
      .from("category_overrides")
      .select("merchant_key,category")
      .eq("user_id", userId)
      .in("merchant_key", chunk);
    if (error) throw new AppError("INTERNAL");
    for (const row of data ?? []) {
      if (isCategory(row.category)) byKey.set(row.merchant_key, { category: row.category, source: "user" });
    }
  }

  const withoutOverrides = keys.filter((key) => !byKey.has(key));
  for (const chunk of batches(withoutOverrides)) {
    const { data, error } = await supabase
      .from("transactions")
      .select("merchant_key,category,occurred_on,created_at")
      .eq("user_id", userId)
      .in("merchant_key", chunk)
      .neq("category_source", "pending")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new AppError("INTERNAL");
    for (const row of data ?? []) {
      if (!byKey.has(row.merchant_key) && isCategory(row.category)) {
        byKey.set(row.merchant_key, { category: row.category, source: "history" });
      }
    }
  }

  for (const key of keys) {
    if (byKey.has(key)) continue;
    const category = categorizeByRule(key);
    if (category !== null) byKey.set(key, { category, source: "rule" });
  }

  const aiKeys = keys.filter((key) => !byKey.has(key));
  const aiBatches = batches(aiKeys);
  if (aiBatches.length === 0) return { byKey, aiFailed: false, rateLimited: false };

  const remainingBatches = await remainingDailyQuota(userId, "classify");
  const allowedBatches = aiBatches.slice(0, remainingBatches);
  const limitedKeys = aiBatches.slice(remainingBatches).flat();
  for (const key of limitedKeys) byKey.set(key, { category: DEFAULT_CATEGORY, source: "pending" });
  if (limitedKeys.length > 0) logger.info("categorize.rate_limited", { keys: limitedKeys.length });

  for (let batchIndex = 0; batchIndex < allowedBatches.length; batchIndex += 1) {
    const chunk = allowedBatches[batchIndex]!;
    let result: Awaited<ReturnType<typeof classify>>;
    try {
      result = await classify(chunk);
    } catch {
      const failedKeys = allowedBatches.slice(batchIndex).flat();
      for (const key of failedKeys) byKey.set(key, { category: DEFAULT_CATEGORY, source: "pending" });
      logger.warn("categorize.ai_failed", { keys: failedKeys.length });
      return { byKey, aiFailed: true, rateLimited: limitedKeys.length > 0 };
    }
    // 요청이 maxDuration에 끊겨도 이미 쓴 배치가 상한에 잡히도록 배치마다 바로 기록한다.
    await recordAiUsage(userId, "classify", result.usage);
    for (const key of chunk) {
      byKey.set(key, { category: result.categories.get(key) ?? DEFAULT_CATEGORY, source: "ai" });
    }
  }

  return { byKey, aiFailed: false, rateLimited: limitedKeys.length > 0 };
}
