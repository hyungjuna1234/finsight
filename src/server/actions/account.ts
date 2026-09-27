import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/domain/errors";
import { adminStorage } from "@/server/admin";
import { createServerSupabase } from "@/services/supabase/server";

export const USER_DATA_TABLES = ["transactions", "uploads", "header_mappings", "category_overrides", "insights", "cards"] as const;

export async function deleteAllData(userId: string): Promise<void> {
  if (!z.uuid().safeParse(userId).success) throw new AppError("INTERNAL");
  try { await adminStorage.removePrefix(`${userId}/`); } catch { throw new AppError("INTERNAL"); }
  const supabase = await createServerSupabase();
  for (const table of USER_DATA_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new AppError("INTERNAL");
  }
}
