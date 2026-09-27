const UNSAFE_CHARACTER_PATTERN = /[\s\u0000-\u001f\u007f\\]/;

export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || UNSAFE_CHARACTER_PATTERN.test(target)) {
    return fallback;
  }
  return target;
}
