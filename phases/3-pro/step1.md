# Step 1: pro-views

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (Pro는 서버에서만 허용)
- `/docs/PRD.md` (전환 장치: Pro 티저), `/docs/USER_FLOWS.md` (③ Pro 티저 목록), `/docs/UI_GUIDE.md` (잠긴 Pro 영역, 증감 색·기호, 차트)
- `/src/lib/analytics/plan.ts`, `/src/server/auth.ts` (`getPlan`, `requirePro`), `/src/server/queries/plan.ts` (Step 0)
- `/src/lib/analytics/compare.ts`, `/src/lib/analytics/recurring.ts`, `/src/lib/analytics/month.ts` (2-dashboard Step 0)
- `/src/server/tx-rows.ts`, `/src/server/queries/dashboard.ts`, `/src/components/dashboard/dashboard-view.tsx` (`proTeasers` 슬롯), `/src/app/(app)/dashboard/page.tsx` (2-dashboard Step 1)
- `/src/lib/demo/fixtures.ts` (`getDemoProPreview`), `/src/components/marketing/demo-pro-preview.tsx`, `/src/app/(marketing)/demo/page.tsx` (2-dashboard Step 4)

## 작업

Free에게는 티저를, Pro에게는 추이·전월 비교·정기결제 목록을 보여준다. **잠긴 데이터는 서버에서 아예 만들지도 보내지도 않는다**(CSS로 가리는 것은 잠금이 아니다). TDD로 진행한다.

### 1. `src/lib/domain/chat.ts`
- `export const CHAT_EXAMPLES: readonly string[]` — 예: "이번 달 식비는 어디에 가장 많이 썼어?", "지난달보다 늘어난 지출은 뭐야?", "구독 결제만 모아서 보여줘", "카페에 한 달에 얼마 쓰는지 알려줘". (3-pro Step 3·4가 이 파일을 확장한다.)

### 2. `src/lib/analytics/teasers.ts` (순수)
```ts
export type RecurringTotal = { count: number; monthlyTotal: KRW };
export type ProPanel =
  | { kind: 'pro'; month: YearMonth; delta: MonthDelta | null; recurring: RecurringTotal }
  | { kind: 'free'; month: YearMonth; recurring: RecurringTotal | null; comparisonLocked: { previousMonth: YearMonth } | null;
      trendLocked: boolean; freeInsight: boolean; chatExamples: readonly string[] };
export function buildFreePanel(i: { month: YearMonth; recurring: RecurringItem[]; previousHasData: boolean; monthsWithData: number; freeInsightAvailable: boolean }): Extract<ProPanel, { kind: 'free' }>
export function buildProPanel(i: { month: YearMonth; current: MonthSummary; previous: MonthSummary | null; recurring: RecurringItem[] }): Extract<ProPanel, { kind: 'pro' }>
```
- Free: `recurring`은 1건 이상일 때만 `recurringSummary` 값(건수·월 합계만), `comparisonLocked`는 전월 데이터가 있을 때만, `trendLocked`는 데이터 달이 2개 이상일 때만 true.
- **누출 테스트**: 가맹점 라벨이 든 `RecurringItem[]`으로 만든 Free 패널을 `JSON.stringify`해도 라벨·`merchantKey`·개별 금액이 나오지 않는다.
- `src/lib/analytics/recurring.ts`에 `RECURRING_LOOKBACK_DAYS = 200` 추가(정기결제 탐지에 읽을 기간).

### 3. 서버 queries (각 테스트: supabase·`@/server/auth` mock)
- `src/server/tx-rows.ts`에 `hasTxInRange(sb, userId, range): Promise<boolean>`(`select('id').limit(1)`) 추가.
- `src/server/queries/dashboard.ts`에 `getProPanel(month: YearMonth): Promise<ProPanel>` 추가: 첫 줄 `requireUser()` → `requireConsent` → `getPlan`. 정기결제는 `kstToday()` 기준 `RECURRING_LOOKBACK_DAYS` 범위를 읽어 `detectRecurring`. Free는 전월을 `hasTxInRange`로 **존재 여부만** 확인하고 `buildFreePanel`. Pro는 이번 달·전월을 읽어 `summarizeMonth` → `buildProPanel`.
- `src/server/queries/trends.ts`:
  ```ts
  export type TrendsData = { state: 'empty' } | { state: 'locked'; monthsWithData: number }
    | { state: 'ready'; months: YearMonth[]; points: TrendPoint[]; delta: MonthDelta | null };
  export async function getTrends(): Promise<TrendsData>
  ```
  첫 줄 `requireUser()` → `requireConsent` → `loadDataMonthSpan`(없으면 empty) → **`requirePro(user.id)`: `PRO_REQUIRED`를 잡으면 `locked` 반환(거래를 읽지 않는다), 다른 에러는 다시 던진다.** Pro: 최신 달까지 최대 12개월을 한 번에 `loadTxViews` → `monthlyTrend`, 2개월 이상이면 마지막 두 달 `compareMonths`.
- `src/server/queries/recurring.ts`:
  ```ts
  export type RecurringData = { state: 'locked'; summary: RecurringTotal } | { state: 'ready'; items: RecurringItem[]; summary: RecurringTotal; asOf: IsoDate };
  export async function getRecurring(): Promise<RecurringData>
  ```
  같은 `requirePro` 패턴. Free도 서버에서 탐지하되 **`summary`(건수·월 합계)만** 반환한다. 테스트로 locked 결과에 `items` 키가 없음을 확인한다.

### 4. 컴포넌트 `src/components/pro/*` (props만, 각 `.test.tsx`)
- `pro-lock.tsx`: props `{ message?: string }` → 왼쪽 정렬 한 줄 "Pro에서 전체 목록을 볼 수 있어요" + [Pro 시작하기](`/pricing`, 4-billing에서 생긴다).
- `recurring-summary.tsx`: `{ count, monthlyTotal, href?: string }` → "정기결제 5건 · 월 ₩47,600".
- `recurring-list.tsx`: `{ items: RecurringItem[] }` → 가맹점·월 예상 금액·최근 결제일·다음 예상일.
- `month-comparison.tsx`: `{ delta: MonthDelta }` → `formatSignedKRW(netDiff, { plus: true })`와 비율(`+12%`), 증가 `text-spend-up`·감소 `text-spend-down`(기호 필수), 늘어난 카테고리 3개.
- `comparison-teaser.tsx`: `{ previousMonth }` → "8월과 비교한 결과가 준비됐어요" + `ProLock`. 숫자 없음.
- `trend-chart.tsx` (client, Recharts): `{ points: TrendPoint[] }` → 월별 막대, 축 `formatKRWShort`, 툴팁 `formatKRW`, 테스트용 목록 병행(jsdom 차트 크기 0).
- `trend-teaser.tsx`: **고정된 장식용 SVG 모양**(사용자 데이터 아님)을 `opacity-40 select-none` + `aria-hidden`으로 그리고 `ProLock`.
- `pro-teasers.tsx`: `{ panel: ProPanel }` → Free: 정기결제 요약 + `ProLock`, 비교 티저, 추이 티저, `freeInsight`면 "첫 AI 리포트는 무료예요 [리포트 만들기]"(`/insights?month=`), 채팅 예시 질문(`/chat` 링크). Pro: `MonthComparison`, 정기결제 요약(`/recurring`), [추이 보기](`/trends`).

### 5. 페이지
- `src/app/(app)/dashboard/page.tsx`: ready일 때 `getProPanel(data.month)` → `proTeasers={<ProTeasers panel={panel} />}`.
- `src/app/(app)/trends/page.tsx`, `src/app/(app)/recurring/page.tsx`: state별로 컴포넌트만 조합(empty → `/upload` 리다이렉트, locked → 티저 + `ProLock`, 목록이 비면 "아직 정기결제를 찾지 못했어요. 석 달 이상 내역을 올리면 찾아 드려요").
- `/demo`: `demo-pro-preview.tsx`의 정적 추이·비교·정기결제 부분을 `TrendChart`·`MonthComparison`·`RecurringSummary`·`RecurringList`로 교체한다(인사이트 문장 부분은 Step 2가 교체). 데모 데이터는 Pro 화면으로 보여준다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - Free 응답(RSC props)에 정기결제 목록·전월 수치·추이 수치가 들어가지 않는가(누출 테스트 통과)?
   - 모든 query 첫 줄이 `requireUser()`이고 Pro 데이터 경로가 `requirePro`/`getPlan`을 거치는가?
   - 컴포넌트가 props만 받고 `/demo`에서 그대로 재사용되는가?
3. 결과에 따라 `phases/3-pro/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실제 데이터를 내려보낸 뒤 `blur`/`opacity`로만 가리지 마라. 이유: HTML·RSC payload에서 그대로 읽힌다. 잠긴 값은 서버에서 만들지 않는다.
- 흐린 추이 티저에 사용자의 실제 월별 금액을 쓰지 마라. 이유: 위와 같다. 고정 장식 모양만 쓴다.
- `backdrop-filter: blur()`, 가운데 정렬 잠금 문구, 이모지 자물쇠를 쓰지 마라. 이유: `docs/UI_GUIDE.md`의 잠긴 영역 규칙·안티패턴.
- 결제·checkout 코드를 만들지 마라. 이유: `/pricing`과 결제는 4-billing 범위다. 링크만 둔다.
- 기존 테스트를 깨뜨리지 마라.
