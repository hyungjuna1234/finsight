import "server-only";

import { isProActive } from "@/lib/analytics/plan";
import { AppError } from "@/lib/domain/errors";
import type { Plan } from "@/lib/domain/types";
import { getConsentStatus } from "@/server/actions/consents";
import { adminEntitlements } from "@/server/admin";
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

export interface ViewerPlan {
  plan: Plan;
  isPro: boolean;
  freeInsightAvailable: boolean;
}

export async function getPlan(userId: string, now: Date = new Date()): Promise<ViewerPlan> {
  const entitlement = await adminEntitlements.get(userId);
  const isPro = isProActive(entitlement, now);

  return {
    plan: isPro ? "pro" : "free",
    isPro,
    freeInsightAvailable: !isPro && entitlement?.freeInsightUsedAt == null,
  };
}

export async function requirePro(userId: string, now: Date = new Date()): Promise<void> {
  if (!(await getPlan(userId, now)).isPro) throw new AppError("PRO_REQUIRED");
}
