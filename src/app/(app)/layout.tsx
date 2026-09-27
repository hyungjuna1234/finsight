import { redirect } from "next/navigation";

import { AppBar } from "@/components/ui/app-bar";
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
      <AppBar />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
