import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/domain/errors";
import { adminAuth, adminStorage } from "@/server/admin";
import { logger } from "@/server/logger";
import { revokeSubscriptions } from "@/services/billing/polar";
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

export async function deleteAccount(userId: string): Promise<{ revoked: number }> {
  if (!z.uuid().safeParse(userId).success) throw new AppError("INTERNAL");

  let revoked: number;
  try {
    revoked = await revokeSubscriptions(userId);
  } catch {
    throw new AppError("BILLING_UNAVAILABLE");
  }

  await adminStorage.removePrefix(`${userId}/`);
  await adminAuth.deleteUser(userId);

  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The hard-deleted user can no longer be resolved; only clearing the local cookie matters.
  }

  logger.info("account.deleted", { revoked });
  return { revoked };
}
