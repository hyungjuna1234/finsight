import "server-only";

import { CONSENT_KINDS, CONSENT_VERSION, missingConsents, type ConsentKind } from "@/lib/domain/consent";
import { AppError } from "@/lib/domain/errors";
import { createServerSupabase } from "@/services/supabase/server";

export async function recordConsents(userId: string, kinds: ConsentKind[]): Promise<void> {
  const selected = new Set(kinds);
  if (!selected.has("age14")) throw new AppError("UNDERAGE");
  if (kinds.length !== CONSENT_KINDS.length || CONSENT_KINDS.some((kind) => !selected.has(kind))) {
    throw new AppError("VALIDATION_FAILED");
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("consents").insert(
    CONSENT_KINDS.map((kind) => ({ user_id: userId, kind, version: CONSENT_VERSION })),
  );
  if (error) throw new AppError("INTERNAL");
}

export async function getConsentStatus(userId: string): Promise<{ missing: ConsentKind[] }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("consents").select("kind, version").eq("user_id", userId);
  if (error) throw new AppError("INTERNAL");
  return { missing: missingConsents(data ?? []) };
}
