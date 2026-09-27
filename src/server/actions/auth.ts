import "server-only";

import { safeRedirect } from "@/lib/domain/redirect";
import { getPublicEnv } from "@/server/env";
import { createServerSupabase } from "@/services/supabase/server";

export type OAuthProvider = "kakao" | "google";
export type StartOAuthResult = { ok: true; url: string } | { ok: false };

export async function startOAuth(provider: OAuthProvider, next: string | null): Promise<StartOAuthResult> {
  const destination = safeRedirect(next);
  const callback = new URL("/auth/callback", getPublicEnv().appUrl);
  callback.searchParams.set("next", destination);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error || !data.url) return { ok: false };
  return { ok: true, url: data.url };
}
