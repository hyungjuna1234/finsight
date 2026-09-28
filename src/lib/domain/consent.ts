export const CONSENT_VERSION = "2026-09";

export const CONSENT_KINDS = ["privacy", "overseas_transfer", "terms", "age14"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_ITEMS: readonly {
  kind: ConsentKind;
  label: string;
  summary: string;
  href?: string;
}[] = [
  { kind: "privacy", label: "개인정보 수집·이용", summary: "로그인 정보와 올린 카드 이용내역을 지출 정리에만 써요.", href: "/privacy" },
  { kind: "overseas_transfer", label: "개인정보 국외 이전", summary: "분류·요약·답변을 위해 가맹점명, 집계값, 가린 샘플 5행, 채팅 질문과 답에 필요한 거래(최대 30건)를 Anthropic(미국)에, 결제 정보를 Polar(미국)에 보내요. 카드번호는 보내지 않아요.", href: "/privacy#overseas" },
  { kind: "terms", label: "이용약관", summary: "FinSight 이용 규칙과 서비스 조건에 동의해요.", href: "/terms" },
  { kind: "age14", label: "만 14세 이상이에요", summary: "만 14세 이상인 경우에만 이용할 수 있어요." },
] as const;

export function missingConsents(agreed: { kind: string; version: string }[]): ConsentKind[] {
  const current = new Set(agreed.filter(({ version }) => version === CONSENT_VERSION).map(({ kind }) => kind));
  return CONSENT_KINDS.filter((kind) => !current.has(kind));
}
