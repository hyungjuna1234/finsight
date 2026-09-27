export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/upload",
  "/trends",
  "/recurring",
  "/insights",
  "/chat",
  "/settings",
  "/billing",
  "/onboarding",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function loginRedirectPath(pathname: string, search: string): string {
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}
