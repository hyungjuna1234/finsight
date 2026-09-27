import { type NextRequest, NextResponse } from "next/server";

import { isProtectedPath, loginRedirectPath } from "@/lib/domain/routes";
import {
  createRequestSupabase,
  type SupabaseCookie,
} from "@/services/supabase/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let pendingCookies: SupabaseCookie[] = [];
  let pendingHeaders: Record<string, string> = {};
  let supabase;
  try {
    supabase = createRequestSupabase({
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        pendingCookies = cookiesToSet;
        pendingHeaders = headers;
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
      },
    });
  } catch {
    return response;
  }

  let loggedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    loggedIn = !error && typeof data?.claims?.sub === "string";
  } catch {
    loggedIn = false;
  }
  if (!loggedIn && isProtectedPath(request.nextUrl.pathname)) {
    response = NextResponse.redirect(
      new URL(loginRedirectPath(request.nextUrl.pathname, request.nextUrl.search), request.url),
    );
  }

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, {
      ...options,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  for (const [name, value] of Object.entries(pendingHeaders)) response.headers.set(name, value);

  return response;
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|auth(?:/|$)|_next(?:/|$)|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
