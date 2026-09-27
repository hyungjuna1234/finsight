export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "PRO_REQUIRED",
  "CONSENT_REQUIRED",
  "UNDERAGE",
  "FORBIDDEN",
  "NOT_FOUND",
  "DUPLICATE_FILE",
  "INVALID_STATE",
  "ALREADY_SUBSCRIBED",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_FORMAT",
  "ENCRYPTED_FILE",
  "EMPTY_FILE",
  "ENCODING_ERROR",
  "CORRUPT_FILE",
  "TOO_MANY_ROWS",
  "FILE_TOO_COMPLEX",
  "HEADER_NOT_FOUND",
  "BILLING_STATEMENT",
  "BANK_STATEMENT",
  "MAPPING_INVALID",
  "NO_DATA",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "BILLING_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  PRO_REQUIRED: 402,
  CONSENT_REQUIRED: 403,
  UNDERAGE: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE_FILE: 409,
  INVALID_STATE: 409,
  ALREADY_SUBSCRIBED: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FORMAT: 415,
  ENCRYPTED_FILE: 422,
  EMPTY_FILE: 422,
  ENCODING_ERROR: 422,
  CORRUPT_FILE: 422,
  TOO_MANY_ROWS: 422,
  FILE_TOO_COMPLEX: 422,
  HEADER_NOT_FOUND: 422,
  BILLING_STATEMENT: 422,
  BANK_STATEMENT: 422,
  MAPPING_INVALID: 422,
  NO_DATA: 422,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  BILLING_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "입력값을 확인해 주세요.",
  UNAUTHENTICATED: "로그인이 필요해요.",
  PRO_REQUIRED: "Pro에서 이용할 수 있어요.",
  CONSENT_REQUIRED: "필수 동의를 완료해 주세요.",
  UNDERAGE: "만 14세 이상만 이용할 수 있어요.",
  FORBIDDEN: "이 작업을 할 권한이 없어요.",
  NOT_FOUND: "요청한 항목을 찾을 수 없어요.",
  DUPLICATE_FILE: "이미 올린 파일이에요.",
  INVALID_STATE: "현재 상태에서는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.",
  ALREADY_SUBSCRIBED: "이미 구독 중이에요. 구독 관리에서 확인해 주세요.",
  FILE_TOO_LARGE: "파일이 10MB보다 커요. 더 작은 파일을 올려 주세요.",
  UNSUPPORTED_FORMAT: "지원하지 않는 파일 형식이에요. CSV, XLS, XLSX 파일을 올려 주세요.",
  ENCRYPTED_FILE: "암호가 걸린 파일이에요. 엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요.",
  EMPTY_FILE: "파일에 내용이 없어요. 카드 이용내역이 있는 파일을 올려 주세요.",
  ENCODING_ERROR: "파일의 글자를 읽을 수 없어요. 엑셀에서 열어 CSV 또는 XLSX로 다시 저장해 주세요.",
  CORRUPT_FILE: "파일이 손상되어 읽을 수 없어요. 원본을 다시 받아 올려 주세요.",
  TOO_MANY_ROWS: "이용내역이 1만 건을 넘어요. 기간을 나눠 받아 올려 주세요.",
  FILE_TOO_COMPLEX: "파일 구조가 너무 복잡해요. 필요한 이용내역만 남겨 다시 저장해 주세요.",
  HEADER_NOT_FOUND: "이용내역의 열 제목을 찾지 못했어요. 카드사에서 받은 원본 파일을 확인해 주세요.",
  BILLING_STATEMENT: "카드 청구서는 아직 지원하지 않아요. 카드사 홈페이지에서 '이용내역'을 받아 올려 주세요.",
  BANK_STATEMENT: "은행 거래내역은 아직 지원하지 않아요. 카드사 홈페이지에서 '이용내역'을 받아 올려 주세요.",
  MAPPING_INVALID: "열 연결을 확인해 주세요. 날짜, 가맹점, 금액 열이 필요해요.",
  NO_DATA: "선택한 기간에 분석할 지출이 없어요.",
  RATE_LIMITED: "오늘 이용 가능한 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.",
  AI_UNAVAILABLE: "지금은 AI 분석을 이용할 수 없어요. 잠시 후 다시 시도해 주세요.",
  BILLING_UNAVAILABLE: "지금은 결제 서비스를 이용할 수 없어요. 잠시 후 다시 시도해 주세요.",
  INTERNAL: "서비스 설정을 확인해 주세요.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string;

  constructor(code: ErrorCode, detail?: string) {
    super(ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.detail = detail;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
