# Step 4: row-parser

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (`parseRows`·`identityKey`·`normalizeMerchant` 시그니처, 마스킹 규칙, `transactions` 테이블)
- `/docs/USER_FLOWS.md` ("거래 해석": 취소·환불·할부·해외 추정)
- `/docs/ADR.md` (ADR-006)
- `/src/lib/domain/types.ts`, `/src/lib/domain/money.ts`(`toKRW`), `/src/lib/domain/month.ts`(`isIsoDate`) (0-foundation)
- `/src/lib/ingest/table.ts`(`TableGuess`, `tableAtHeader`, `isSummaryRow`), `/src/lib/ingest/parse.ts`(`parseDateCell`, `parseAmountCell`), `/src/lib/ingest/mask.ts`(`maskDigits`), `/src/lib/ingest/mapping.ts`(`ColumnMapping`) (Step 2)
- `/src/test/fixtures/statements.ts` (Step 0 — `expect.parsed`, `FIXTURE_TODAY`, `hyundaiForeignPair`)

## 작업

TDD로 진행한다(구현 파일마다 같은 폴더에 테스트 먼저).

### 1. `src/lib/ingest/merchant.ts`
```ts
export function normalizeMerchant(raw: string): string;
```
- NFKC → 라틴 문자 대문자 → 연속 공백 하나로 → 앞뒤 공백·구두점 제거.
- 결제대행·법인 표기 **접두사**를 뗀다: `KCP-`·`KCP_`·`NICE-`·`KSNET`·`(주)`·`㈜`·`주식회사`·`네이버페이 `·`NAVERPAY`·`카카오페이_`·`카카오페이 `·`PAYCO `·`토스페이 ` 등(표로 관리, 반복 적용).
- 지점명 등 뒤쪽은 **유지**한다(`스타벅스 강남점` → `스타벅스 강남점`). 100자에서 자른다. 결과가 비면 `알 수 없음`.

### 2. `src/lib/ingest/parse.ts`에 추가
```ts
export type SkipReason = "summary" | "blank" | "bad_date" | "bad_amount" | "zero_amount";
export interface ParsedRow {
  index: number;                     // (헤더 적용 후) table.dataRows 기준
  occurredOn: IsoDate; merchantRaw: string; merchantKey: string;
  amountKrw: KRW; kind: TxKind; status: TxStatus;
  approvalNo: string | null; installmentMonths: number | null;
  foreignAmount: number | null; foreignCurrency: string | null;
  cardLast4: string | null;          // DB에 저장하지 않는다(MVP). 전체 카드번호를 들고 다니지 않기 위한 값
  occurrence: number;                // 같은 파일 안 같은 식별 기준의 순번(0부터)
}
export interface ParseResult { rows: ParsedRow[]; skipped: { index: number; reason: SkipReason }[]; period: { from: IsoDate; to: IsoDate } | null }
export function parseRows(table: TableGuess, mapping: ColumnMapping, today: IsoDate): ParseResult;
```
행 처리 순서(위에서 걸리면 건너뛴다):
1. `mapping.headerRowIndex`가 `table.headerRowIndex`와 다르면 `tableAtHeader`로 다시 자른다(null이면 행 0개 결과).
2. `isSummaryRow` → `summary`. 날짜·가맹점·금액 셀이 모두 비었으면 → `blank`.
3. 날짜: `parseDateCell`. 연도가 없으면 — `periodHint`가 있으면 `from`~`to` 사이 연도 중 날짜가 `[from−31일, to+31일]`에 드는 연도(12월→1월 경계: 12/28은 from 연도, 01/03은 to 연도), 없으면 `today`의 연도이되 결과가 `today+31일`보다 뒤면 전년도. 파싱 실패, `2000-01-01` 이전, `today+31일` 이후 → `bad_date`.
4. 금액: `parseAmountCell`. null → `bad_amount`, 0 → `zero_amount`. 음수면 `kind: "refund"`, 양수면 `"spend"`. `amountKrw = toKRW(절댓값)`.
5. 상태: `cancelFlag` 열 값(NFKC, 공백 제거)이 `취소`를 포함하고 `부분취소`가 아니면 `cancelled`. 그 열의 **헤더에 `취소`가 있을 때만** `Y`·`예`·`O`도 취소로 본다(`매입여부: Y`를 취소로 오인하지 않게). `부분취소`는 금액 부호대로 환불 처리.
6. 해외: `foreignAmount`가 0이 아닌 숫자이거나 `foreignCurrency`가 비어 있지 않고 `KRW`·`원`이 아니면 해외 건. 통화는 대문자 3글자(셀 → 해외금액 셀 안의 코드 → 헤더 괄호 `(USD)` 순, `$`는 USD). 해외 건이면서 상태 값에 `미매입`·`매입전`·`미확정`·`승인대기`가 있거나 금액 셀에 `예상`·`추정`·`미확정`이 있으면 `pending`(취소가 우선). 나머지는 `posted`.
7. 할부: `일시불`·빈 값·0·1 → null, `3`·`03`·`3개월` → 3, 2~60만 인정.
8. 가맹점: `merchantRaw = maskDigits(셀).slice(0, 100)`(비면 `알 수 없음`), `merchantKey = normalizeMerchant(merchantRaw)`. 승인번호: 공백 제거한 영숫자, 비면 null. 카드번호 열: 숫자만 모아 **끝 4자리**, 4자리 미만이면 null.
9. `occurrence`: 승인번호가 없으면 `(occurredOn, merchantKey, amountKrw, kind)`, 있으면 `(approvalNo, occurredOn, kind)`가 같은 행끼리 파일 순서대로 0, 1, 2… `period`는 파싱된 행의 최소·최대 날짜(없으면 null).

### 3. `src/lib/ingest/identity.ts`
```ts
export function identityKey(i: { userId: string; cardId: string; approvalNo: string | null; occurredOn: IsoDate;
  kind: TxKind; merchantKey: string; amountKrw: KRW; occurrence: number }): string;   // sha256 hex 64자
```
- **해시 선택**: `import { createHash } from "node:crypto"`의 sha256. 결정적인 표준 라이브러리라 lib에서 허용하며(ESLint 레이어 규칙 대상 아님), 64비트 자작 해시는 충돌 시 서로 다른 거래가 합쳐질 수 있어 쓰지 않는다. 이 파일은 서버에서만 쓴다.
- 입력은 필드 배열을 `JSON.stringify`한 문자열(구분자 모호성 제거)로 해시한다. 앞에 버전 문자열 `"v1"`을 넣는다.
- 승인번호가 있으면 `["v1","a", userId, cardId, approvalNo, occurredOn, kind]` — **금액 제외**(추정 금액 → 확정 금액 갱신). `occurrence > 0`이면 끝에 붙인다(같은 파일 안 키 충돌로 upsert가 실패하지 않게; 0이면 ARCHITECTURE 식 그대로).
- 승인번호가 없으면 `["v1","n", userId, cardId, occurredOn, merchantKey, amountKrw, kind, occurrence]`.

### 4. 테스트
- `merchant.test.ts`: 접두사 표, NFKC(전각 → 반각), 지점명 유지, 빈 값.
- `parse.test.ts`(추가): `expect.parsed`가 있는 **모든** fixture(heavy 포함)를 sniff → decode → detectTable → `parseRows(table, { headerRowIndex: expect.headerRowIndex, columns: expect.mapping }, FIXTURE_TODAY)`로 돌려 `rows`·`spend`·`refund`·`cancelled`·`pending`·`netSpendKrw`·`skipped` 사유별 개수·`period`가 **정확히** 같다. 추가로: 삼성 12월→1월 연도, 연도 없고 periodHint 없을 때 연말 경계, 엑셀 일련번호, 신한 `스마트스토어 #` 마스킹, 카드번호 끝 4자리, `매입여부: Y`는 취소가 아님.
- `identity.test.ts`: `hyundaiForeignPair()` 두 파일의 해외 건 키가 같고(금액 17,650 → 17,812) 앞 파일은 pending, 뒤 파일은 posted. 국내 2건 키도 두 파일에서 같다. `lotteUtf16Tsv`의 똑같은 2행은 occurrence 0·1로 키가 다르다. 신한의 같은 날·같은 금액 2건(승인번호 다름)도 키가 다르다. userId·cardId가 다르면 키가 다르다. 한 fixture 안 모든 키가 유일하다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 금액이 모두 정수 `KRW`(0 이상)이고 방향은 `kind`로만 표현되는가?
   - `merchantRaw`에 7자리 이상 숫자열이 남지 않고, 카드번호는 끝 4자리만 남는가?
   - `src/lib/**`가 next·react·supabase·server·services를 import하지 않는가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 모듈과 주요 export 이름, 해시 선택을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `identityKey`에 `Math.random`·`Date.now`·행 인덱스·업로드 ID를 넣지 마라. 이유: 같은 거래를 다시 올렸을 때 같은 키가 나와야 중복이 막힌다.
- 승인번호 있는 거래의 키에 금액을 넣지 마라. 이유: 해외 추정 금액이 확정될 때 새 거래로 중복 저장된다.
- 금액을 부동소수점 그대로 저장하지 마라. 이유: 합계 오차. 원 단위 정수로 반올림한다.
- fixture 기대값에 맞추려고 fixture 파일을 고치지 마라. 이유: fixture는 명세다. 파서가 틀렸으면 파서를 고친다(fixture 자체의 명백한 오류일 때만 수정하고 summary에 적는다).
- 기존 테스트를 깨뜨리지 마라.
