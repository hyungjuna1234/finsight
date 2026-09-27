import { describe, expect, it } from "vitest";
import { PLAN_FEATURES, PRO_BASE_PRICE_LABEL, PRO_MONTHLY_KRW } from "./pricing";

describe("pricing constants", () => {
  it("keeps the shared Pro price and comparison copy", () => {
    expect(PRO_MONTHLY_KRW).toBe(6900);
    expect(PRO_BASE_PRICE_LABEL).toBe("$4.99");
    expect(PLAN_FEATURES).toEqual([
      { label: "업로드·자동 분류", free: "포함", pro: "포함" },
      { label: "월별 대시보드", free: "포함", pro: "포함" },
      { label: "여러 달 추이·전월 비교", free: "—", pro: "포함" },
      { label: "정기결제 목록", free: "—", pro: "포함" },
      { label: "AI 인사이트 리포트", free: "첫 1회 무료", pro: "포함" },
      { label: "Q&A 채팅", free: "—", pro: "포함" },
    ]);
  });
});
