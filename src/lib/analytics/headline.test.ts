import { describe, expect, it } from "vitest";

import { toKRW } from "@/lib/domain/money";
import type { YearMonth } from "@/lib/domain/types";

import type { MonthSummary } from "./month";
import { monthHeadline } from "./headline";

function summary(overrides: Partial<MonthSummary> = {}): MonthSummary {
  return {
    month: "2026-09" as YearMonth,
    spend: toKRW(100_000),
    refund: toKRW(0),
    net: 100_000,
    count: 1,
    byCategory: [{ category: "식비", amount: toKRW(60_000), count: 1 }, { category: "교통", amount: toKRW(40_000), count: 1 }],
    topMerchants: [],
    daily: [],
    pendingCount: 0,
    ...overrides,
  };
}

describe("monthHeadline", () => {
  it("거래가 없으면 문장을 만들지 않는다", () => {
    expect(monthHeadline(summary({ count: 0 }))).toBeNull();
  });

  it.each([0, -1])("순지출이 %s이면 환불 문장을 만든다", (net) => {
    expect(monthHeadline(summary({ net }))).toBe("9월에는 환불이 더 많았어요.");
  });

  it("순지출과 가장 큰 카테고리 비율을 조사에 맞춰 설명한다", () => {
    expect(monthHeadline(summary())).toBe("9월에 ₩100,000 썼어요. 식비가 60%로 가장 많아요.");
    expect(monthHeadline(summary({ spend: toKRW(120_000), refund: toKRW(20_000), net: 100_000 })))
      .toBe("9월에 ₩100,000 썼어요. 식비가 60%로 가장 많아요.");
    expect(monthHeadline(summary({ byCategory: [{ category: "카페·간식", amount: toKRW(70_000), count: 1 }, { category: "식비", amount: toKRW(30_000), count: 1 }] })))
      .toBe("9월에 ₩100,000 썼어요. 카페·간식이 70%로 가장 많아요.");
  });

  it("합쳐진 기타가 가장 커도 가장 큰 실제 카테고리를 사용한다", () => {
    const categories: MonthSummary["byCategory"] = [
      { category: "식비", amount: toKRW(18), count: 1 },
      { category: "교통", amount: toKRW(16), count: 1 },
      { category: "쇼핑", amount: toKRW(14), count: 1 },
      { category: "주거·통신", amount: toKRW(12), count: 1 },
      { category: "의료·건강", amount: toKRW(10), count: 1 },
      { category: "교육", amount: toKRW(8), count: 1 },
      { category: "문화·여가", amount: toKRW(7), count: 1 },
      { category: "여행·숙박", amount: toKRW(6), count: 1 },
      { category: "보험·금융", amount: toKRW(5), count: 1 },
      { category: "기타", amount: toKRW(4), count: 1 },
    ];
    expect(monthHeadline(summary({ spend: toKRW(100), net: 100, byCategory: categories })))
      .toBe("9월에 ₩100 썼어요. 식비가 18%로 가장 많아요.");
  });

  it("카테고리가 없으면 지출 문장만 만든다", () => {
    expect(monthHeadline(summary({ byCategory: [] }))).toBe("9월에 ₩100,000 썼어요.");
  });
});
