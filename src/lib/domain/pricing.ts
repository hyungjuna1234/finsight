import type { KRW } from "./types";

export const PRO_MONTHLY_KRW = 6900 as KRW;
export const PRO_BASE_PRICE_LABEL = "$4.99";

export const PLAN_FEATURES: { label: string; free: string; pro: string }[] = [
  { label: "업로드·자동 분류", free: "포함", pro: "포함" },
  { label: "월별 대시보드", free: "포함", pro: "포함" },
  { label: "여러 달 추이·전월 비교", free: "—", pro: "포함" },
  { label: "정기결제 목록", free: "—", pro: "포함" },
  { label: "AI 인사이트 리포트", free: "첫 1회 무료", pro: "포함" },
  { label: "Q&A 채팅", free: "—", pro: "포함" },
];
