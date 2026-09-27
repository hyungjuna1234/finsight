import "server-only";

import { DEFAULT_CATEGORY, isCategory, type Category } from "@/lib/domain/categories";
import { AppError } from "@/lib/domain/errors";
import type { CategorySource } from "@/lib/domain/types";
import { categorizeByRule } from "@/lib/ingest/rules";
import { logger } from "@/server/logger";
import { classify } from "@/services/claude/classifier";
import type { ClaudeUsage } from "@/services/claude/models";
import { createServerSupabase } from "@/services/supabase/server";

export interface CategorizeResult {
  byKey: Map<string, { category: Category; source: CategorySource }>;
  usage: ClaudeUsage[];
  aiFailed: boolean;
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
  const usage: ClaudeUsage[] = [];
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
  for (let batchIndex = 0; batchIndex < aiBatches.length; batchIndex += 1) {
    const chunk = aiBatches[batchIndex]!;
    try {
      const result = await classify(chunk);
      usage.push(result.usage);
      for (const key of chunk) {
        byKey.set(key, { category: result.categories.get(key) ?? DEFAULT_CATEGORY, source: "ai" });
      }
    } catch {
      const failedKeys = aiBatches.slice(batchIndex).flat();
      for (const key of failedKeys) byKey.set(key, { category: DEFAULT_CATEGORY, source: "pending" });
      logger.warn("categorize.ai_failed", { keys: failedKeys.length });
      return { byKey, usage, aiFailed: true };
    }
  }

  return { byKey, usage, aiFailed: false };
}
