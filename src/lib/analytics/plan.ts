import type { Plan } from "@/lib/domain/types";

export const PRO_GRACE_DAYS = 7;

export interface BillingSubscription {
  id: string;
  status: string;
  productId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface CustomerState {
  subscriptions: BillingSubscription[];
}

export interface EntitlementLike {
  plan: Plan;
  periodEnd: Date | null;
}

export function isProActive(entitlement: EntitlementLike | null, now: Date): boolean {
  if (entitlement?.plan !== "pro") return false;
  if (entitlement.periodEnd === null) return true;

  const graceMilliseconds = PRO_GRACE_DAYS * 24 * 60 * 60 * 1_000;
  return entitlement.periodEnd.getTime() + graceMilliseconds > now.getTime();
}
