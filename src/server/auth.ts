import "server-only";

import { AppError } from "@/lib/domain/errors";
import { getConsentStatus } from "@/server/actions/consents";
import { createServerSupabase } from "@/services/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}

export async function requireConsent(userId: string): Promise<void> {
  const { missing } = await getConsentStatus(userId);
  if (missing.length > 0) throw new AppError("CONSENT_REQUIRED");
}
