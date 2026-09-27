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
      name: "카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "예시 보기" })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: "무료로 시작" }).first()).toHaveAttribute(
    "href",
    /^\/login\?next=/,
  );
  for (const text of [
    "연동 없음 · 카드사에서 받은 파일만 올려요",
    "원본은 90일 후 자동 삭제 · 언제든 전부 삭제할 수 있어요",
    "AI에는 가맹점명과 집계값만 보내요 · 카드번호는 보내지 않아요",
  ]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  expect(cspViolations).toEqual([]);
});
