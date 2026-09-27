import { expect, test } from "@playwright/test";

for (const path of ["/dashboard", "/settings"]) {
  test(`${path}는 비로그인 사용자를 로그인으로 보낸다`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}
