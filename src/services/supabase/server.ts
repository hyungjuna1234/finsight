import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer, CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/server/env";
import type { Database } from "@/types/database";

export interface SupabaseCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

export function createRequestSupabase(cookieMethods: CookieMethodsServer): SupabaseClient<Database> {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, { cookies: cookieMethods });
}

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createRequestSupabase({
    getAll: () => cookieStore.getAll(),
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      } catch {
        // Server Components cannot write cookies. src/proxy.ts refreshes them.
      }
    },
  });
}
