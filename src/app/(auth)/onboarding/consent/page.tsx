import { redirect } from "next/navigation";

import { ConsentForm } from "@/components/auth/consent-form";
import { OnboardingSteps } from "@/components/ui/onboarding-steps";
import { CONSENT_ITEMS } from "@/lib/domain/consent";
import { safeRedirect } from "@/lib/domain/redirect";
import { loginRedirectPath } from "@/lib/domain/routes";
import { getConsentStatus } from "@/server/actions/consents";
import { getOptionalUser } from "@/server/auth";

export default async function ConsentPage() {
  const user = await getOptionalUser();
  if (!user) redirect(safeRedirect(loginRedirectPath("/onboarding/consent", ""), "/login"));
  const { missing } = await getConsentStatus(user.id);
  if (missing.length === 0) redirect(safeRedirect("/dashboard"));

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <section className="space-y-8">
        <OnboardingSteps current={1} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">FinSight</p>
          <h1 className="text-2xl font-semibold text-ink">서비스 이용에 동의해 주세요</h1>
          <p className="text-sm leading-relaxed text-body">카드 이용내역을 안전하게 정리하는 데 필요한 필수 항목이에요.</p>
        </div>
        <ConsentForm items={CONSENT_ITEMS} />
      </section>
    </main>
  );
}
