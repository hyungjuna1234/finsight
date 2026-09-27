import type { Category } from "@/lib/domain/categories";
import { normalizeMerchant } from "@/lib/ingest/merchant";

const RAW_RULES: readonly { category: Category; keywords: readonly string[] }[] = [
  { category: "구독·디지털", keywords: ["쿠팡와우", "넷플릭스", "NETFLIX", "유튜브", "YOUTUBE", "멜론", "SPOTIFY", "APPLE.COM"] },
  { category: "식비", keywords: ["쿠팡이츠", "배달의민족", "요기요", "맥도날드", "버거킹", "롯데리아"] },
  { category: "카페·간식", keywords: ["스타벅스", "이디야", "투썸", "메가커피", "컴포즈", "빽다방", "파리바게뜨", "배스킨라빈스"] },
  { category: "마트·편의점", keywords: ["GS25", "CU", "세븐일레븐", "이마트24", "이마트", "홈플러스", "롯데마트", "코스트코"] },
  { category: "교통", keywords: ["카카오T", "코레일", "티머니", "SRT", "지하철", "고속버스", "택시"] },
  { category: "자동차", keywords: ["주유소", "SK에너지", "GS칼텍스", "S-OIL", "하이패스", "주차"] },
  { category: "쇼핑", keywords: ["쿠팡", "11번가", "G마켓", "무신사", "올리브영", "다이소"] },
  { category: "주거·통신", keywords: ["SKT", "KT", "LGU+", "관리비", "도시가스", "한국전력"] },
  { category: "의료·건강", keywords: ["병원", "의원", "약국", "치과", "한의원"] },
  { category: "교육", keywords: ["학원", "교보문고", "예스24", "인프런"] },
  { category: "문화·여가", keywords: ["CGV", "메가박스", "롯데시네마", "노래방"] },
  { category: "여행·숙박", keywords: ["호텔", "야놀자", "여기어때", "에어비앤비", "대한항공", "제주항공"] },
  { category: "보험·금융", keywords: ["보험", "생명", "화재", "연회비"] },
  { category: "경조사·선물", keywords: ["꽃", "플라워", "선물하기"] },
] as const;

export const CATEGORY_RULES: readonly { category: Category; keywords: readonly string[] }[] =
  RAW_RULES.map(({ category, keywords }) => ({
    category,
    keywords: keywords.map(normalizeMerchant),
  }));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(merchantKey: string, keyword: string): boolean {
  if (/^[A-Z]{1,3}$/.test(keyword)) {
    return new RegExp(`(^|[^A-Z0-9])${escapeRegExp(keyword)}($|[^A-Z0-9])`, "u").test(merchantKey);
  }
  return merchantKey.includes(keyword);
}

export function categorizeByRule(merchantKey: string): Category | null {
  const normalized = normalizeMerchant(merchantKey);
  for (const { category, keywords } of CATEGORY_RULES) {
    if (keywords.some((keyword) => matches(normalized, keyword))) return category;
  }
  return null;
}
