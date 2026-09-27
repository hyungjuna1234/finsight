import { CheckoutStatus } from "@/components/billing/checkout-status";
import { safeRedirect } from "@/lib/domain/redirect";

export default async function BillingSuccessPage({ searchParams }: { searchParams: Promise<{ checkout_id?: string | string[]; next?: string | string[] }> }) {
  const query = await searchParams;
  const checkoutId = typeof query.checkout_id === "string" ? query.checkout_id : null;
  const next = safeRedirect(typeof query.next === "string" ? query.next : null, "/dashboard");
  return <div className="space-y-6"><h1 className="text-2xl font-semibold text-ink">결제 확인</h1><CheckoutStatus checkoutId={checkoutId} next={next} /></div>;
}
