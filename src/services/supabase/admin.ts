import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import type { Database } from "@/types/database";

export function createAdminSupabase(): SupabaseClient<Database> {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
