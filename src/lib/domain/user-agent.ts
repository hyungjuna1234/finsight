export type InAppBrowser = "kakaotalk" | "instagram" | "facebook" | "naver" | "line";

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  const normalized = ua.toLowerCase();
  if (normalized.includes("kakaotalk")) return "kakaotalk";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("fban/") || normalized.includes("fbav/")) return "facebook";
  if (normalized.includes("naver(inapp")) return "naver";
  if (/\bline\//i.test(ua)) return "line";
  return null;
}
