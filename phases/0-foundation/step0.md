# Step 0: env-domain

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (도메인 타입, 에러 코드 표, 디렉토리)
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md` (금액·차트 표기 규칙)
- `/package.json`, `/vitest.config.mts`, `/eslint.config.mjs`, `/.env.example`
- `/src/test/smoke.test.ts` (테스트 작성 방식 참고)

이 step은 이후 모든 step이 import하는 도메인 기초 모듈을 만든다. 이름과 시그니처를 정확히 지켜라.

## 작업

TDD로 진행한다: 각 파일마다 같은 폴더에 `X.test.ts`를 먼저 쓰고, 실패를 확인한 뒤 구현한다.

### 1. `src/lib/domain/types.ts` (테스트 불필요)
`docs/ARCHITECTURE.md`의 도메인 타입을 그대로 정의한다: `TxKind`, `TxStatus`, `CategorySource`, `KRW`, `YearMonth`, `IsoDate`, `Plan`.
추가로 화면·집계가 공유할 거래 뷰 타입:
```ts
export interface TxView {
  id: string; cardId: string | null; occurredOn: IsoDate; merchantRaw: string; merchantKey: string;
  amountKrw: KRW; kind: TxKind; status: TxStatus; category: Category; categorySource: CategorySource;
  installmentMonths: number | null; foreignAmount: number | null; foreignCurrency: string | null;
}
```

### 2. `src/lib/domain/categories.ts`
- `export const CATEGORIES` — ARCHITECTURE.md의 15개, 순서 그대로.
- `export type Category`, `export function isCategory(x: unknown): x is Category`.
- `export const DEFAULT_CATEGORY: Category = '기타'`.

### 3. `src/lib/domain/result.ts`
- `Result<T, E extends string>`, `ok(value)`, `err(error)`.

### 4. `src/lib/domain/money.ts`
- `toKRW(n: number): KRW` — 정수이고 0 이상이 아니면 `RangeError`.
- `formatKRW(amount: KRW): string` → `₩1,234,000` (항상 원 단위, 천 단위 쉼표).
- `formatKRWShort(amount: KRW): string` → 차트 축용 만원 단위: `0`→`0`, `9,999`→`1만`(반올림), `120,000`→`12만`, `12,340,000`→`1,234만`.
- `sumKRW(values: KRW[]): KRW`.

### 5. `src/lib/domain/month.ts` (KST 고정, `@date-fns/tz`의 `TZDate` 사용 가능)
- `kstToday(now?: Date): IsoDate`
- `toYearMonth(input: Date | IsoDate): YearMonth` — Date는 KST로 환산해서 월을 정한다(UTC 2026-08-31T15:30Z → `2026-09`).
- `isYearMonth(s: string): s is YearMonth`, `isIsoDate(s: string): s is IsoDate` (실제 달력 날짜만 true: `2026-02-30`은 false)
- `monthRange(ym: YearMonth): { from: IsoDate; to: IsoDate }` (말일 포함, 윤년 처리)
- `prevMonth(ym)`, `nextMonth(ym)`, `monthsBetween(from: YearMonth, to: YearMonth): YearMonth[]` (양끝 포함, from > to면 빈 배열)

### 6. `src/lib/domain/errors.ts`
- `ERROR_CODES` 상수 배열과 `ErrorCode` 타입 — ARCHITECTURE.md 에러 코드 표의 **모든** 코드(`VALIDATION_FAILED`, `UNAUTHENTICATED`, `PRO_REQUIRED`, `CONSENT_REQUIRED`, `UNDERAGE`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_FILE`, `INVALID_STATE`, `ALREADY_SUBSCRIBED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `ENCRYPTED_FILE`, `EMPTY_FILE`, `ENCODING_ERROR`, `CORRUPT_FILE`, `TOO_MANY_ROWS`, `FILE_TOO_COMPLEX`, `HEADER_NOT_FOUND`, `BILLING_STATEMENT`, `BANK_STATEMENT`, `MAPPING_INVALID`, `NO_DATA`, `RATE_LIMITED`, `AI_UNAVAILABLE`, `BILLING_UNAVAILABLE`, `INTERNAL`).
- `ERROR_STATUS: Record<ErrorCode, number>` — 표의 HTTP 상태. (413=`FILE_TOO_LARGE`, 415=`UNSUPPORTED_FORMAT`, 나머지 파일 계열 422)
- `ERROR_MESSAGES: Record<ErrorCode, string>` — 사용자에게 보여줄 한국어 해요체 문장. 무엇이 문제이고 어떻게 하면 되는지. 예: `ENCRYPTED_FILE` → "암호가 걸린 파일이에요. 엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요." `BANK_STATEMENT` → "은행 거래내역은 아직 지원하지 않아요. 카드사 홈페이지에서 '이용내역'을 받아 올려 주세요."
- `class AppError extends Error { readonly code: ErrorCode; readonly status: number; }` — `new AppError(code, detail?)`. `message`는 `ERROR_MESSAGES[code]`. `detail`은 서버 내부용(응답·로그에 내보내지 않는다).
- `isAppError(e: unknown): e is AppError`.

### 7. `src/lib/domain/redirect.ts`
- `safeRedirect(target: string | null | undefined, fallback = '/dashboard'): string`
  - `/`로 시작하는 같은 오리진 경로만 허용. `//evil.com`, `/\evil.com`, `\\evil`, `https://…`, `javascript:…`, 공백·제어문자 포함, 빈 값 → `fallback`.
  - 쿼리·해시는 유지(`/dashboard?month=2026-09`).
- 테스트는 위 입력들을 표로 검증한다.

### 8. `src/server/env.ts`
- 첫 줄 `import "server-only";`
- zod로 두 스키마를 정의하고 **지연 검증** 함수만 export한다(모듈 로드 시 읽지 않는다):
  - `getPublicEnv()` → `{ appUrl, supabaseUrl, supabaseAnonKey }` (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - `getServerEnv()` → 위 + `supabaseServiceRoleKey`, `anthropicApiKey`, `polarAccessToken`, `polarWebhookSecret`, `polarServer: 'sandbox'|'production'`, `polarProProductId`, `cronSecret`
  - 누락·형식 오류 시 `AppError('INTERNAL', '누락된 변수 이름 목록')` — **값은 절대 메시지에 넣지 않는다.**
  - 각 함수는 필요한 변수만 검사하도록 `getServerEnv(keys?)`처럼 부분 검증을 지원해도 된다(선택).
- 테스트는 `vi.stubEnv`로 값을 넣고 빼며 검증한다. 에러 메시지에 값이 포함되지 않는지 확인한다.

## Acceptance Criteria

```bash
npm run lint    # 레이어 규칙 포함 에러 없음
npm run build   # env 없이 빌드 성공
npm run test    # 모든 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/**`가 next·react·supabase·server·services를 import하지 않는가?
   - 테스트가 대상과 같은 폴더에 `X.test.ts`로 있는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 모듈과 주요 export 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `process.env`를 모듈 최상단에서 읽지 마라. 이유: env가 없는 빌드(harness, CI)가 깨진다.
- 금액을 `toLocaleString` 등으로 여기저기서 직접 포맷하지 마라. 이유: 표기가 흩어진다. `formatKRW`/`formatKRWShort`만 쓴다.
- 날짜를 서버 로컬 시간대나 UTC 기준으로 월에 배정하지 마라. 이유: 한국 사용자의 월말·월초 거래가 다른 달로 잡힌다.
- 에러 메시지·로그에 env 값을 넣지 마라. 이유: 비밀키 유출.
- `.env*` 파일을 만들거나 읽지 마라(`.env.example`만 참고). 이유: 보안 hook이 차단하며, 실제 키는 이 복사본에 없다.
- 기존 테스트를 깨뜨리지 마라.
