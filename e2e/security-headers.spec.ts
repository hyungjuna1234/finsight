import { expect, test } from "@playwright/test";

test("공개 응답에 보안 헤더가 적용된다", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.status()).toBe(200);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("img-src 'self' data:");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toBeTruthy();
  expect(headers["x-powered-by"]).toBeUndefined();
});
