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

export function derivePlan(
  state: CustomerState | null,
  now: Date,
  proProductId: string,
): { plan: Plan; status: string; periodEnd: Date | null } {
  if (state === null) return { plan: "free", status: "none", periodEnd: null };

  const proSubscriptions = state.subscriptions.filter(({ productId }) => productId === proProductId);
  const latestFirst = [...proSubscriptions].sort((left, right) =>
    (right.currentPeriodEnd?.getTime() ?? Number.NEGATIVE_INFINITY)
    - (left.currentPeriodEnd?.getTime() ?? Number.NEGATIVE_INFINITY));
  const eligible = latestFirst.filter((subscription) =>
    ["active", "trialing", "past_due"].includes(subscription.status)
    || (subscription.status === "canceled"
      && subscription.cancelAtPeriodEnd
      && subscription.currentPeriodEnd !== null
      && now < subscription.currentPeriodEnd));
  const selected = eligible[0];

  if (selected) {
    return { plan: "pro", status: selected.status, periodEnd: selected.currentPeriodEnd };
  }
  return { plan: "free", status: latestFirst[0]?.status ?? "none", periodEnd: null };
}

export function isProActive(entitlement: EntitlementLike | null, now: Date): boolean {
  if (entitlement?.plan !== "pro") return false;
  if (entitlement.periodEnd === null) return true;

  const graceMilliseconds = PRO_GRACE_DAYS * 24 * 60 * 60 * 1_000;
  return entitlement.periodEnd.getTime() + graceMilliseconds > now.getTime();
}
