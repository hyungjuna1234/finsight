export const CATEGORIES = [
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
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export const DEFAULT_CATEGORY: Category = "기타";
