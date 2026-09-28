// 카드사별 실제 메뉴 경로는 아직 확인 전이며, 사람이 확인한 뒤 verifiedAt에 날짜를 넣는다.
import type { ErrorCode } from "./errors";

export type IssuerId =
  | "shinhan"
  | "samsung"
  | "hyundai"
  | "kb"
  | "lotte"
  | "hana";

export interface IssuerGuide {
  id: IssuerId;
  name: string;
  steps: string[];
  note?: string;
  verifiedAt: string | null;
}

function issuerGuide(id: IssuerId, name: string): IssuerGuide {
  return {
    id,
    name,
    steps: [
      `${name} 홈페이지에 로그인해요.`,
      "'이용내역 조회' 메뉴로 가요. '청구서(명세서)'가 아니라 '이용내역'이에요.",
      "기간은 최근 3개월로 골라 조회해요.",
      "'엑셀 저장' 또는 '파일 다운로드'를 눌러요. 암호를 걸었다면 풀고 저장해요.",
    ],
    verifiedAt: null,
  };
}

export const ISSUER_GUIDES: readonly IssuerGuide[] = [
  issuerGuide("shinhan", "신한카드"),
  issuerGuide("samsung", "삼성카드"),
  issuerGuide("hyundai", "현대카드"),
  issuerGuide("kb", "KB국민카드"),
  issuerGuide("lotte", "롯데카드"),
  issuerGuide("hana", "하나카드"),
];

export interface TroubleItem {
  code: ErrorCode;
  title: string;
  fix: string;
}

export const TROUBLESHOOTING: readonly TroubleItem[] = [
  {
    code: "ENCRYPTED_FILE",
    title: "암호가 걸린 파일이에요",
    fix: "엑셀에서 열어 '다른 이름으로 저장'으로 암호 없이 저장한 뒤 올려요.",
  },
  {
    code: "BILLING_STATEMENT",
    title: "카드 청구서를 받았어요",
    fix: "청구서는 결제일 기준으로 묶여 있어요. 카드사에서 '이용내역'을 받아 주세요.",
  },
  {
    code: "BANK_STATEMENT",
    title: "은행 거래내역을 받았어요",
    fix: "아직 카드 이용내역만 받아요. 카드사에서 이용내역 파일을 받아 주세요.",
  },
  {
    code: "FILE_TOO_LARGE",
    title: "파일이 10MB보다 커요",
    fix: "기간을 3개월 정도로 나눠 받아요.",
  },
  {
    code: "TOO_MANY_ROWS",
    title: "이용내역이 1만 행을 넘어요",
    fix: "기간을 3개월 정도로 나눠 받아요.",
  },
  {
    code: "UNSUPPORTED_FORMAT",
    title: "PDF나 이미지 파일이에요",
    fix: "CSV·xls·xlsx 파일로 받아 주세요.",
  },
];

export function troubleAnchor(code: ErrorCode): string {
  return `trouble-${code.toLowerCase().replaceAll("_", "-")}`;
}

export function guideHrefForError(code: string): string | null {
  const item = TROUBLESHOOTING.find((candidate) => candidate.code === code);
  return item ? `/guide#${troubleAnchor(item.code)}` : null;
}
