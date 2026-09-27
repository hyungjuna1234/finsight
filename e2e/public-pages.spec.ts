import { expect, test, type Page } from "@playwright/test";

async function openPublicPage(page: Page, path: string): Promise<void> {
  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspViolations.push(message.text());
    }
  });

  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  expect(cspViolations).toEqual([]);
}

test("demo에 샘플 대시보드를 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/demo");
  await expect(page.getByText("샘플 데이터예요 · 실제 화면과 같아요")).toBeVisible();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  await expect(page.getByText("이번 달 지출", { exact: true })).toBeVisible();
});

test("pricing에 가격과 결제 조건을 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/pricing");
  await expect(page.getByText(/₩6,900/)).toBeVisible();
  await expect(page.getByText(/국내전용 카드는 결제되지 않아요/)).toBeVisible();
});

test("guide에 여섯 카드사 안내를 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/guide");
  await expect(page.getByRole("heading", { name: "카드 이용내역 받는 법" })).toBeVisible();
  for (const issuer of ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "하나카드"]) {
    await expect(page.getByText(issuer, { exact: true })).toBeVisible();
  }
});

test("privacy에 초안 표시와 국외 이전 정보를 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/privacy");
  await expect(page.getByText("초안 — 법률 검토 전", { exact: true })).toBeVisible();
  await expect(page.locator("#overseas table").getByText("Anthropic PBC", { exact: true })).toBeVisible();
});

test("terms에 비조언 범위를 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/terms");
  await expect(page.getByRole("heading", { name: "조언이 아님" })).toBeVisible();
});

test("refund에 7일 환불 조건을 보여 준다", async ({ page }) => {
  await openPublicPage(page, "/refund");
  await expect(page.getByText(/결제 후 7일 이내/)).toBeVisible();
});
