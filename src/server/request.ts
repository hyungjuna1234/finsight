import "server-only";

import { isIP } from "node:net";

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  if (forwarded && isIP(forwarded) !== 0) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  return real && isIP(real) !== 0 ? real : null;
}
