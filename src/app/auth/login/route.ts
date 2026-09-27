import { safeRedirect } from "@/lib/domain/redirect";
import { startOAuth, type OAuthProvider } from "@/server/actions/auth";

const PROVIDERS = new Set<OAuthProvider>(["kakao", "google"]);

function localRedirect(req: Request, path: string): Response {
  return Response.redirect(new URL(safeRedirect(path, "/login"), req.url), 302);
}

export async function GET(req: Request): Promise<Response> {
  const search = new URL(req.url).searchParams;
  const provider = search.get("provider");
  if (!provider || !PROVIDERS.has(provider as OAuthProvider)) {
    return localRedirect(req, "/login?error=provider");
  }

  const result = await startOAuth(provider as OAuthProvider, search.get("next"));
  if (!result.ok) return localRedirect(req, "/login?error=oauth");
  return Response.redirect(result.url, 302);
}
