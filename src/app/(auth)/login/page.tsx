import { headers } from "next/headers";

import { LoginPanel } from "@/components/auth/login-panel";
import { detectInAppBrowser } from "@/lib/domain/user-agent";

type LoginSearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const [requestHeaders, query] = await Promise.all([headers(), searchParams]);
  return (
    <LoginPanel
      next={typeof query.next === "string" ? query.next : null}
      error={typeof query.error === "string" ? query.error : null}
      inAppBrowser={detectInAppBrowser(requestHeaders.get("user-agent") ?? "")}
    />
  );
}
