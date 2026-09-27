import { describe, expect, it } from "vitest";

import { CATEGORIES, DEFAULT_CATEGORY, isCategory } from "./categories";

describe("categories", () => {
  it("정의된 15개 카테고리를 순서대로 제공한다", () => {
    expect(CATEGORIES).toEqual([
      "식비",
      "카페·간식",
      "마트·편의점",
      "교통",
      "자동차",
      "쇼핑",
      "주거·통신",
      "의료·건강",
      "교육",
      "문화·여가",
      "여행·숙박",
      "구독·디지털",
      "보험·금융",
      "경조사·선물",
      "기타",
    ]);
    expect(DEFAULT_CATEGORY).toBe("기타");
  });

  it.each([["식비", true], ["기타", true], ["없는 분류", false], [null, false], [1, false]])(
    "isCategory(%j)는 %s를 반환한다",
    (value, expected) => {
      expect(isCategory(value)).toBe(expected);
    },
  );
});
