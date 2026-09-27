import { safeRedirect } from "@/lib/domain/redirect";
import { createServerSupabase } from "@/services/supabase/server";

function localRedirect(req: Request, path: string): Response {
  return Response.redirect(new URL(safeRedirect(path), req.url), 302);
}

export async function GET(req: Request): Promise<Response> {
  const search = new URL(req.url).searchParams;
  if (search.has("error")) return localRedirect(req, "/login?error=cancelled");

  const code = search.get("code");
  if (!code) return localRedirect(req, "/login?error=callback");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return localRedirect(req, "/login?error=callback");

  return localRedirect(req, safeRedirect(search.get("next"), "/dashboard"));
}
