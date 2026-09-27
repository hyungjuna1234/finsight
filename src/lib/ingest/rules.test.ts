import { describe, expect, it } from "vitest";

import { CATEGORIES } from "@/lib/domain/categories";
import { categorizeByRule, CATEGORY_RULES } from "@/lib/ingest/rules";
import { normalizeMerchant } from "@/lib/ingest/merchant";

describe("categorizeByRule", () => {
  it.each([
    ["스타벅스 강남", "카페·간식"],
    ["GS25 역삼점", "마트·편의점"],
    ["카카오T 블루", "교통"],
    ["SK에너지 주유소", "자동차"],
    ["배달의민족", "식비"],
    ["11번가", "쇼핑"],
    ["LGU+ 통신요금", "주거·통신"],
    ["서울치과의원", "의료·건강"],
    ["교보문고", "교육"],
    ["CGV 왕십리", "문화·여가"],
    ["대한항공", "여행·숙박"],
    ["NETFLIX.COM", "구독·디지털"],
    ["삼성화재", "보험·금융"],
    ["카카오 선물하기", "경조사·선물"],
  ])("분류표의 %s를 %s로 분류한다", (merchant, category) => {
    expect(categorizeByRule(normalizeMerchant(merchant))).toBe(category);
  });

  it.each([
    ["쿠팡와우 월회비", "구독·디지털"],
    ["쿠팡이츠 주문", "식비"],
    ["쿠팡 로켓배송", "쇼핑"],
  ])("구체적인 쿠팡 키워드를 먼저 적용한다", (merchant, category) => {
    expect(categorizeByRule(normalizeMerchant(merchant))).toBe(category);
  });

  it("짧은 영문 키워드는 토큰으로만 일치시킨다", () => {
    expect(categorizeByRule("CUCKOO")).toBeNull();
    expect(categorizeByRule("CU 강남점")).toBe("마트·편의점");
  });

  it("모르는 가맹점은 기타로 추측하지 않는다", () => {
    expect(categorizeByRule("처음보는상점")).toBeNull();
  });

  it("60개 이상의 정규화된 키워드와 유효한 카테고리만 가진다", () => {
    expect(CATEGORY_RULES.flatMap(({ keywords }) => keywords).length).toBeGreaterThanOrEqual(60);
    for (const rule of CATEGORY_RULES) {
      expect(CATEGORIES).toContain(rule.category);
      expect(rule.category).not.toBe("기타");
      for (const keyword of rule.keywords) expect(keyword).toBe(normalizeMerchant(keyword));
    }
  });
});
