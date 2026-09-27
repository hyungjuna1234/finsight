import { redirect } from "next/navigation";

import { safeRedirect } from "@/lib/domain/redirect";
import { loginRedirectPath } from "@/lib/domain/routes";
import { getConsentStatus } from "@/server/actions/consents";
import { getOptionalUser } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect(safeRedirect(loginRedirectPath("/dashboard", ""), "/login"));
  const { missing } = await getConsentStatus(user.id);
  if (missing.length > 0) redirect(safeRedirect("/onboarding/consent"));

  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <span className="text-base font-semibold text-ink">FinSight</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
