import { expect, test } from "@playwright/test";

test("랜딩의 핵심 문구와 이동 경로를 보여 준다", async ({ page }) => {
  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspViolations.push(message.text());
    }
  });

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "월급이 어디로 새는지, 파일 하나로 AI가 찾아 드려요",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인 없이 예시 보기" })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: "무료로 시작" }).first()).toHaveAttribute(
    "href",
    /^\/login\?next=/,
  );
  for (const text of ["새는 돈이 숫자로 보여요", "AI에는 기능에 필요한 만큼만 보내요", "이번 달 지출, 파일 하나로 정리해 보세요"]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("cell", { name: "질문과, 답에 필요한 거래 30건 이하(날짜·가맹점·금액)" })).toBeVisible();
  expect(cspViolations).toEqual([]);
});

test("390px 화면에서 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
