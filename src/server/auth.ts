import "server-only";

import { AppError } from "@/lib/domain/errors";
import { createServerSupabase } from "@/services/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}
