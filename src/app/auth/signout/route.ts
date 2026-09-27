import { safeRedirect } from "@/lib/domain/redirect";
import { handler } from "@/server/handler";
import { createServerSupabase } from "@/services/supabase/server";

export const POST = handler({ auth: "user" }, async ({ req }) => {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return Response.redirect(new URL(safeRedirect("/", "/"), req.url), 303);
});
