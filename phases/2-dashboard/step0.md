# Step 0: analytics-core

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (핵심 순수 함수 시그니처, 도메인 타입)
- `/docs/USER_FLOWS.md` (거래 해석: 취소·환불·할부·해외 추정 금액)
- `/docs/ADR.md` (ADR-009)
- `/src/lib/domain/types.ts` (`TxView`, `KRW`, `YearMonth`, `IsoDate`), `/src/lib/domain/categories.ts`
- `/src/lib/domain/money.ts` (`toKRW`, `formatKRW`, `formatKRWShort`, `sumKRW`), `/src/lib/domain/month.ts` (`kstToday`, `toYearMonth`, `monthRange`, `prevMonth`, `nextMonth`, `monthsBetween`, `isYearMonth`, `isIsoDate`)
- `/src/test/fixtures/statements.ts` (1-ingest의 합성 fixture — 거래 형태 참고)

이 step은 대시보드·추이·정기결제·인사이트·채팅·데모가 모두 쓰는 **집계 순수 함수**를 만든다. 이름과 시그니처를 정확히 지켜라.

## 작업

TDD로 진행한다: 파일마다 같은 폴더에 `X.test.ts`를 먼저 쓰고 실패를 확인한 뒤 구현한다. 테스트는 **입력 표(table-driven)** 로 쓴다.

### 0. 테스트 헬퍼 `src/test/tx-factory.ts`
- `makeTx(overrides?: Partial<TxView>): TxView` — 기본값(`kind:'spend'`, `status:'posted'`, `category:'기타'`, 고유 id 등)을 채운다. 이후 step의 테스트도 이 헬퍼를 쓴다.

### 1. 도메인 보강 (`src/lib/domain/*`, 기존 테스트 파일에 케이스 추가)
- `month.ts`: `addDays(d: IsoDate, n: number): IsoDate`, `daysBetween(a: IsoDate, b: IsoDate): number`(b−a, 일 단위), `formatMonthLabel(ym: YearMonth, style?: 'long' | 'short'): string` → `'2026년 9월'` / `'9월'`.
  - 날짜 계산은 `Date.UTC(y, m-1, d)` 기반으로 한다(서버 로컬 시간대 무관). 월말·윤년 경계 테스트 포함.
- `money.ts`: `formatSignedKRW(n: number, opts?: { plus?: boolean }): string` — 음수 가능한 정수(순지출·증감)용. `-12000` → `−₩12,000`(U+2212), `12000` → `₩12,000`, `plus: true`면 `+₩12,000`, `0` → `₩0`. 내부에서 `formatKRW`를 쓴다.

### 2. `src/lib/analytics/month.ts`
```ts
export interface CategoryTotal { category: Category; amount: KRW; count: number }
export interface MerchantTotal { merchantKey: string; label: string; amount: KRW; count: number }
export interface DailyTotal { date: IsoDate; amount: KRW }
export interface MonthSummary {
  month: YearMonth; spend: KRW; refund: KRW; net: number;   // net = spend − refund (음수 가능 → KRW 아님)
  count: number; byCategory: CategoryTotal[]; topMerchants: MerchantTotal[]; daily: DailyTotal[]; pendingCount: number;
}
export function summarizeMonth(txs: TxView[], month: YearMonth): MonthSummary
export function collapseCategories(items: CategoryTotal[], max?: number): CategoryTotal[]   // 기본 8
```
규칙:
- `occurredOn`이 `monthRange(month)` 안인 거래만 쓴다. **문자열 비교로 판단하고 `new Date(occurredOn)`으로 바꾸지 않는다**(UTC 해석 시 월 경계가 밀린다).
- `status === 'cancelled'`는 모든 합계·건수에서 제외한다. `pending`(해외 추정 금액)은 금액에 포함하고 `pendingCount`로 따로 센다.
- `spend` = spend 합, `refund` = refund 합, `net = spend − refund`. `count` = 제외되지 않은 거래 수(spend+refund).
- 할부(`installmentMonths`)는 나누지 않고 **이용일에 총액**으로 잡는다.
- `byCategory`: 카테고리별 (spend − refund), 0 이하는 제외, `count`는 그 카테고리 spend 건수. 금액 내림차순, 같으면 `CATEGORIES` 순서.
- `topMerchants`: `merchantKey`별 (spend − refund) 상위 5개(0 이하 제외). `label`은 그 키의 가장 최근 거래 `merchantRaw`. 정렬: 금액 desc → 건수 desc → merchantKey asc.
- `daily`: 그 달 1일~말일 **모든 날짜**를 포함하고, 각 날의 spend 합(환불 제외, 없으면 0).
- `collapseCategories`: 상위 `max`개만 남기고 나머지와 기존 `'기타'`를 하나의 `'기타'`로 합친다(차트 9번째부터 "기타" 규칙, UI_GUIDE).
- 필수 테스트: 빈 배열, 월 경계(`2026-08-31`/`2026-09-01`), 취소 제외, 환불이 지출보다 큰 달(`net < 0`), 해외 추정 건수, 할부 총액, 동률 정렬, 윤년 2월 `daily` 길이.

### 3. `src/lib/analytics/compare.ts`
```ts
export interface CategoryDelta { category: Category; current: KRW; previous: KRW; diff: number }
export interface MonthDelta { month: YearMonth; previousMonth: YearMonth; netDiff: number; netRate: number | null; topIncreases: CategoryDelta[] }
export interface TrendPoint { month: YearMonth; net: number }
export function compareMonths(current: MonthSummary, previous: MonthSummary): MonthDelta
export function monthlyTrend(txs: TxView[], months: YearMonth[]): TrendPoint[]
```
- `netRate` = `previous.net > 0`이면 `(current.net − previous.net) / previous.net`(소수, 0.12 = 12%), 아니면 `null`. 반올림은 표시 쪽이 한다.
- `topIncreases`: 두 달 중 한쪽에만 있는 카테고리도 포함(없으면 0). `diff > 0`만, 내림차순 상위 3개.
- `monthlyTrend`는 월마다 `summarizeMonth`를 재사용한다(합계 정의가 한 곳에만 있게). 거래가 없는 달은 `net: 0`. 입력 `months` 순서를 유지한다.

### 4. `src/lib/analytics/recurring.ts`
```ts
export const RECURRING_RULES = { minOccurrences: 3, minGapDays: 25, maxGapDays: 35, amountRate: 0.1, amountAbs: 1000, activeWithinDays: 45 } as const;
export interface RecurringItem {
  merchantKey: string; label: string; avgAmount: KRW; lastDate: IsoDate; occurrences: number;
  monthlyEstimate: KRW; nextExpectedDate: IsoDate;
}
export function detectRecurring(txs: TxView[], asOf: IsoDate): RecurringItem[]
export function recurringSummary(items: RecurringItem[]): { count: number; monthlyTotal: KRW }
```
- 대상: `kind === 'spend'`이고 `cancelled`가 아닌 거래. `merchantKey`로 묶고 날짜 오름차순 정렬.
- **가장 최근 거래에서 거꾸로** 이어지는 사슬을 만든다: 인접 간격이 25~35일(양끝 포함)이고, 금액이 가장 최근 금액 기준 `±10%` **또는** `±₩1,000` 안이면 이어진다. 조건이 깨지면 멈춘다.
- 사슬 길이 ≥ 3이고 `daysBetween(lastDate, asOf) ≤ 45`이면 정기결제다.
- `avgAmount` = 사슬 평균(반올림 정수), `monthlyEstimate` = `avgAmount`, `nextExpectedDate` = `lastDate + 평균 간격(반올림)`, `label` = 마지막 거래 `merchantRaw`. 결과는 `monthlyEstimate` 내림차순.
- 필수 테스트: 간격 24·36일(탈락), 25·35일(통과), 금액 +10% 경계, 소액 ±₩1,000 경계, 가격 인상으로 사슬 끊김, 2회만(탈락), 마지막이 46일 전(탈락), 환불·취소 무시, 빈 배열.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/analytics/**`가 next·react·supabase·server·services를 import하지 않는가?
   - 금액 합계가 모두 정수이고, 음수 가능 값(`net`, `diff`)을 `KRW` 타입으로 속이지 않았는가?
   - AGENTS.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/2-dashboard/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (파일과 주요 export 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 집계를 SQL 함수나 DB 뷰로 만들지 마라. 이유: 집계는 TypeScript 순수 함수로만 한다(plan 1-1장). 데모·채팅·인사이트가 같은 함수를 재사용한다.
- `IsoDate`를 `new Date(str)`로 파싱해 월·요일을 정하지 마라. 이유: UTC로 해석되어 KST 월 경계가 틀어진다.
- `Math.random`·현재 시각을 함수 안에서 읽지 마라. 이유: 순수 함수여야 테스트가 결정적이다. 기준일은 `asOf` 인자로 받는다.
- 할부를 개월 수로 나눠 여러 달에 배분하지 마라. 이유: 카드 이용내역 기준 이용일 총액으로 잡기로 정했다.
- 기존 테스트를 깨뜨리지 마라.
