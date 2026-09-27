import "server-only";

import type { Category } from "@/lib/domain/categories";
import { AppError } from "@/lib/domain/errors";
import { createServerSupabase } from "@/services/supabase/server";

export async function setCategory(userId: string, txId: string, input: { category: Category; scope: "one" | "merchant" }): Promise<{ updated: number }> {
  const sb = await createServerSupabase();
  const { data: tx, error: readError } = await sb.from("transactions").select("merchant_key").eq("id", txId).eq("user_id", userId).maybeSingle();
  if (readError) throw new AppError("INTERNAL"); if (!tx) throw new AppError("NOT_FOUND");
  if (input.scope === "one") {
    const { error } = await sb.from("transactions").update({ category: input.category, category_source: "user" }).eq("id", txId).eq("user_id", userId);
    if (error) throw new AppError("INTERNAL"); return { updated: 1 };
  }
  const { error: overrideError } = await sb.from("category_overrides").upsert({ user_id: userId, merchant_key: tx.merchant_key, category: input.category }, { onConflict: "user_id,merchant_key" });
  if (overrideError) throw new AppError("INTERNAL");
  const { data, error } = await sb.from("transactions").update({ category: input.category, category_source: "user" }).eq("user_id", userId).eq("merchant_key", tx.merchant_key).select("id");
  if (error) throw new AppError("INTERNAL"); return { updated: data?.length ?? 0 };
}
