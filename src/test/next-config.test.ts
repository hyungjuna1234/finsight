import { afterEach, describe, expect, it, vi } from "vitest";

import config from "../../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function getHeaders(): Promise<Record<string, string>> {
  expect(config.headers).toBeTypeOf("function");
  const entries = await config.headers!();
  const allPaths = entries.find((entry) => entry.source === "/(.*)");

  expect(allPaths).toBeDefined();
  return Object.fromEntries(allPaths!.headers.map(({ key, value }) => [key, value]));
}

describe("Next.js security headers", () => {
  it("applies the required security headers to every path", async () => {
    const headers = await getHeaders();

    expect(config.poweredByHeader).toBe(false);
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains",
    );
  });

  it("uses a self-based CSP that blocks images and framing from external origins", async () => {
    const csp = (await getHeaders())["Content-Security-Policy"];

    expect(csp).toMatch(/^default-src 'self';/);
    expect(csp).toContain("img-src 'self' data: blob:;");
    expect(csp).toContain("frame-ancestors 'none';");
    expect(csp).toContain("object-src 'none';");
    expect(csp).toContain("base-uri 'self';");
  });

  it("does not permit development-only script sources in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = (await getHeaders())["Content-Security-Policy"];

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("va.vercel-scripts.com");
  });
});
