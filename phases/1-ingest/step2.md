# Step 2: table-detect

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Claude에는 마스킹한 헤더+샘플 5행만)
- `/docs/ARCHITECTURE.md` (`detectTable`·`maskSamples`·`headerSignature`·`validateMapping` 시그니처, 마스킹 규칙)
- `/docs/ADR.md` (ADR-003, ADR-004)
- `/src/lib/domain/result.ts`, `/src/lib/domain/types.ts`(`IsoDate`), `/src/lib/domain/month.ts`(`isIsoDate`) (0-foundation)
- `/src/lib/ingest/sniff.ts`, `/src/lib/ingest/decode.ts`(`Sheet`), `/src/lib/domain/upload.ts` (Step 1)
- `/src/test/fixtures/statements.ts` (Step 0 — `expect.headerRowIndex`·`headers`·`mapping`·`periodHint`)

## 작업

TDD로 진행한다(구현 파일마다 같은 폴더에 `X.test.ts` 먼저).

### 1. `src/lib/ingest/table.ts`
```ts
export interface TableGuess {
  sheetName: string;
  sheetRows: string[][];        // 선택된 시트의 전체 행(decode 결과 그대로) — 헤더 행을 바꿀 때 다시 자른다
  headerRowIndex: number;       // sheetRows 기준
  headers: string[];
  dataRows: string[][];         // 헤더 아래 행 중 완전히 빈 행을 뺀 것. 각 행은 headers 길이로 패딩
  periodHint: { from: IsoDate; to: IsoDate } | null;
}
export const HEADER_VOCAB: { date: string[]; merchant: string[]; amount: string[]; other: string[]; billing: string[]; bank: string[] };
export function normalizeHeader(h: string): string;           // NFKC, 공백 제거, 괄호 부분 제거("국내이용금액(원)"→"국내이용금액"), 소문자
export function isSummaryRow(cells: string[]): boolean;        // 어떤 셀이든 공백 제거 후 합계·소계·총계·총합계·total로 시작
export function tableAtHeader(table: TableGuess, headerRowIndex: number): TableGuess | null;   // 범위 밖이면 null
export function detectTable(sheets: Sheet[]): Result<TableGuess, "HEADER_NOT_FOUND" | "BILLING_STATEMENT" | "BANK_STATEMENT">;
```
- 어휘 예시(각 20개 안팎으로 채운다): date `이용일자·이용일·이용일시·거래일자·거래일·거래일시·승인일자·매출일자·사용일`, merchant `가맹점명·가맹점·이용가맹점·이용하신곳·이용처·사용처·상호`, amount `이용금액·국내이용금액·승인금액·매출금액·결제금액·원화금액·거래금액·금액`, other `승인번호·할부·할부개월·할부기간·해외이용금액·현지금액·통화·통화코드·취소여부·상태·매입상태·카드번호·이용카드·결제방법`, billing `회차·청구금액·결제원금·청구원금·잔여금액`, bank `잔액·거래후잔액·입금·출금·입금액·출금액·맡기신금액·찾으신금액·적요`.
- 헤더 행 탐지: 각 시트의 **앞 30행**에서, 비어 있지 않은 셀이 3개 이상이고 어휘와 일치하는 셀이 2개 이상이며 date 계열이 하나 이상 있는 행을 후보로 본다. 점수 = 어휘 일치 수(같은 점수면 위쪽). 그 위의 제목행은 건너뛴다.
- 시트가 여러 개면 **데이터 행이 가장 많은 표**를 고른다(같으면 앞 시트).
- 고른 헤더에 billing 어휘(`회차`·`청구금액`·`결제원금`·`청구원금`)가 있으면 `BILLING_STATEMENT`, `잔액`과 입금·출금 계열이 함께 있으면 `BANK_STATEMENT`. 후보가 없으면 `HEADER_NOT_FOUND`.
- `periodHint`: 선택된 시트의 앞 30행(헤더 위 제목행 포함)에서 `YYYY.MM.DD ~ YYYY.MM.DD`(구분자 `.`·`-`·`/`, `YYYY년 M월 D일` 형식, `~`·`-` 사이 공백 허용)를 찾아 `{ from, to }`. 실제 달력 날짜가 아니거나 from > to면 null.
- 한 시트 안에 표가 여러 개인 경우는 MVP 범위 밖이다(헤더 아래 전부를 데이터로 본다 — 두 번째 헤더 행은 Step 4에서 날짜 이상으로 건너뛴다).

### 2. `src/lib/ingest/mask.ts` — Claude로 보내기 전 마스킹
```ts
export function maskDigits(text: string): string;
export function maskSamples(headers: string[], rows: string[][]): { headers: string[]; samples: string[][] };
```
- `maskDigits`: 먼저 날짜·시각 패턴(`YYYY-MM-DD`·`YYYY.MM.DD`·`YYYY/MM/DD`·`YYYYMMDD`, 뒤따르는 `HH:MM[:SS]`)은 보존한다. 나머지에서 숫자와 구분자(`-`·공백·`*`·`.`)로 이어진 토큰의 **숫자 개수가 7 이상이면 `#`** 하나로 바꾼다. 쉼표는 구분자가 아니므로 `1,234,567`은 남는다.
- `maskSamples`: 셀마다 — 빈 셀 그대로 → `maskDigits` 적용 → 결과가 숫자·금액(`-`, `(`, `₩`, `원`, 쉼표, 소수점 포함)·날짜·`#`뿐이면 그대로 → 값 어휘(`Y`·`N`·`정상`·`취소`·`부분취소`·`매입`·`미매입`·`일시불`·`N개월`·대문자 3글자 통화 코드 등)면 그대로 → 그 외 텍스트는 `첫 글자***(N자)`(N은 원래 셀의 글자 수, 첫 글자는 마스킹 후 문자열의 첫 글자).
- 헤더는 `normalizeHeader`한 값이 `HEADER_VOCAB` 어디에도 없으면 텍스트 셀과 같은 방식으로 마스킹한다(헤더 자리에 이름이 들어간 파일 대비).
- 호출하는 쪽(Step 6)이 요약행을 뺀 **첫 5행만** 넘긴다. 이 함수는 받은 행 전부를 마스킹한다.

### 3. `src/lib/ingest/parse.ts` — 셀 단위 파서 (Step 4에서 `parseRows`를 이 파일에 추가한다)
```ts
export interface DateParts { year: number | null; month: number; day: number }
export function parseDateCell(raw: string): DateParts | null;
export function parseAmountCell(raw: string): number | null;   // 부호 있는 정수(원)
```
- 날짜: `YYYY-MM-DD`·`YYYY.MM.DD`·`YYYY/MM/DD`(한 자리 월·일 허용), `YYYYMMDD`, `YY.MM.DD`(→ 20YY), `YYYY년 M월 D일`, 연도 없는 `MM/DD`·`MM-DD`·`MM.DD`·`M월 D일`(year null), 엑셀 일련번호(20000~80000의 숫자, 소수부는 버림, 기준일 1899-12-30). 뒤따르는 시각·요일(`(월)`)은 무시. 실제 달력 날짜가 아니면 null.
- 금액: `1,234`·`1,234원`·`₩1,234`·`KRW 1,234`·`-1,234`·`1,234-`·`(1,234)`(→ 음수)·`13,456.7`(→ 13457, 0에서 먼 쪽으로 반올림)·`예상 17,650`(`예상`·`추정`·`미확정` 표시는 무시). 빈 셀·그 외 문자가 남으면 null.

### 4. `src/lib/ingest/mapping.ts`
```ts
export const columnMappingSchema = z.object({ … }).strict();   // zod 4. 타입 주석을 달지 말고 추론시킨다(.shape 사용)
// { headerRowIndex: int 0..29, columns: z.object({ date, merchant, amount: int 0..99; approvalNo?, installment?, cancelFlag?, foreignAmount?, foreignCurrency?, cardNumber?: int 0..99 }).strict() }
export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type MappingColumns = ColumnMapping["columns"];
export function headerSignature(headers: string[]): string;
export function validateMapping(mapping: ColumnMapping, table: TableGuess): Result<ColumnMapping, "MAPPING_INVALID">;
```
- `headerSignature`: `normalizeHeader`한 헤더에서 끝의 빈 헤더를 떼고 `\u001f`로 이어 **sha256 hex**(`import { createHash } from "node:crypto"`). 순서가 바뀌면 달라지고, 공백·NFD·대소문자 차이는 같다. (`node:crypto`는 결정적인 표준 라이브러리라 lib에서 허용한다. lib/ingest는 서버에서만 쓰이고 컴포넌트는 lib/ingest를 **값으로** import하지 않는다.)
- `validateMapping`: `mapping.headerRowIndex`로 `tableAtHeader`(null이면 실패) → 모든 열 인덱스 < headers 길이 → date·merchant·amount가 서로 다름 → 샘플 = 데이터 행 앞 20개(요약행, 날짜·가맹점·금액 셀이 모두 빈 행 제외, 0개면 실패) → `parseDateCell`과 `parseAmountCell`이 각각 **95% 이상** 성공. 성공하면 입력 매핑을 그대로 돌려준다.

### 5. 테스트
- `table.test.ts`: `expect.headerRowIndex`가 있는 모든 fixture를 sniff → decode → `detectTable`해 `sheetName`·`headerRowIndex`·`headers`·`periodHint`가 같다. 청구서·은행·헤더 없음 fixture는 해당 에러. 제목행·빈 행 아래 헤더, `isSummaryRow`, `tableAtHeader` 경계.
- `mask.test.ts`: 입력→출력 표 — `1234-5678-9012-3456`·`1234-****-****-5678`·`010-1234-5678`·`01012345678`·`900101-1234567`·`110-123-456789`·`123-45-67890` → `#` 포함, `1,234,567`·`2026.09.01 12:34`·`12.99`·`미매입`·`USD` 보존, `스타벅스 강남점` → `스***(8자)`, 모르는 헤더 마스킹.
- `parse.test.ts`: 날짜·금액 형식 표(실패 입력 포함: `2026-02-30`, `abc`, 빈 문자열).
- `mapping.test.ts`: 모든 성공 fixture에서 `validateMapping(expect.mapping)`이 ok, date와 merchant를 바꾼 매핑·범위 밖 인덱스·중복 인덱스는 `MAPPING_INVALID`. `headerSignature` 안정성.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/**`가 next·react·supabase·server·services를 import하지 않는가?
   - 마스킹 결과에 7자리 이상 숫자열(구분자 포함)과 원문 가맹점명이 남지 않는가?
   - 테스트가 대상과 같은 폴더에 있는가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 모듈과 주요 export 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 헤더 탐지를 카드사별 하드코딩(파일명·시트명으로 분기)으로 하지 마라. 이유: 형식이 바뀌면 깨진다. 어휘 점수로만 판단한다.
- 날짜를 `new Date(string)`으로 파싱하지 마라. 이유: 런타임·시간대마다 결과가 다르고 `2026.09.01`을 못 읽는다.
- 마스킹에서 날짜까지 `#`으로 지우지 마라. 이유: Claude가 날짜 열을 알아볼 수 없다. 날짜는 개인정보가 아니다.
- `validateMapping` 기준(95%, 샘플 20행)을 낮추지 마라. 이유: 자동 확정(autoConfirm)의 안전장치다.
- 기존 테스트를 깨뜨리지 마라.
