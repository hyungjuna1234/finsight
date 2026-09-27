# Step 2: transactions

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (API 표의 `PATCH /api/transactions/:id`, `transactions`·`category_overrides` 테이블)
- `/docs/ADR.md` (ADR-005: 사용자 지정 분류가 다음 업로드에 반영됨)
- `/docs/USER_FLOWS.md` (③ 카테고리 수정 [이번 건만][같은 가맹점 모두], 거래 해석), `/docs/UI_GUIDE.md`
- `/src/server/handler.ts` (`handler({ auth, consent, body })`, ctx `{ user, body, params }`), `/src/server/auth.ts`
- `/src/server/tx-rows.ts` (`toTxView`, `loadDataMonthSpan`), `/src/server/queries/dashboard.ts` (Step 1)
- `/src/lib/analytics/dashboard.ts` (`resolveMonth`), `/src/lib/domain/categories.ts`, `/src/lib/domain/month.ts`
- `/src/components/ui/api-fetch.ts` (`apiFetch`, `ApiError`, `redirectPathForError`), `/src/components/dashboard/month-picker.tsx`
- `/src/server/actions/categorize.ts` (1-ingest: override를 먼저 보는 분류 순서 확인)

## 작업

TDD로 진행한다(파일마다 같은 폴더에 테스트 먼저).

### 1. `src/lib/domain/tx-filters.ts`
```ts
export interface TxFilters { month: YearMonth | null; category: Category | null; cardId: string | null; q: string | null; cursor: number }
export function parseTxFilters(sp: Record<string, string | string[] | undefined>): TxFilters
export function toTxFilterQuery(f: Partial<TxFilters>): string   // '?month=…&category=…' (빈 값 생략)
export function escapeLike(q: string): string                     // % _ \ 이스케이프
```
- 잘못된 값은 조용히 `null`/`0`으로: `month`는 `isYearMonth`, `category`는 `isCategory`, `cardId`는 UUID 형식, `q`는 trim 후 1~50자, `cursor`는 0 이상 정수(offset). 배열 값은 첫 항목만.

### 2. `src/lib/analytics/list.ts`
- `groupByDate(txs: TxView[]): { date: IsoDate; items: TxView[]; net: number }[]` — 날짜 내림차순, 그룹 안은 입력 순서 유지. `net`은 취소 제외 spend − refund.

### 3. `src/server/queries/transactions.ts`
```ts
import "server-only";
export const TX_PAGE_SIZE = 100;
export type TxListData = { state: 'empty' } | {
  state: 'ready'; month: YearMonth; availableMonths: YearMonth[]; filters: TxFilters;
  items: TxView[]; nextCursor: number | null; cards: { id: string; name: string }[];
};
export async function listTransactions(filters: TxFilters): Promise<TxListData>
```
- 첫 줄 `requireUser()`, 이어서 `requireConsent`. RLS client(`createServerSupabase`)만 쓴다.
- 월: `loadDataMonthSpan` + `resolveMonth(filters.month)`. 범위 `monthRange(month)`.
- 필터: `category` → `.eq`, `cardId` → `.eq('card_id')`, `q` → **`.ilike('merchant_raw', `%${escapeLike(q)}%`)` 메서드로만**(`.or()` 문자열 조립 금지 — PostgREST 필터 주입). `merchant_raw`는 1-ingest에서 숫자 마스킹된 값이라 부분 검색에 써도 된다.
- 정렬 `occurred_on desc, id desc`, `.range(cursor, cursor + TX_PAGE_SIZE)`로 한 행 더 읽어 `nextCursor` 결정. 카드 목록은 `cards`에서 `id, name`.
- 테스트: supabase 체인 mock으로 필터별 호출 인자(`ilike` 이스케이프 포함)와 `nextCursor` 검증.

### 4. `src/server/actions/transactions.ts`
```ts
import "server-only";
export async function setCategory(userId: string, txId: string, input: { category: Category; scope: 'one' | 'merchant' }): Promise<{ updated: number }>
```
- 먼저 `.eq('id', txId).eq('user_id', userId).maybeSingle()`로 `merchant_key`를 읽는다. 없으면(남의 거래 포함) `AppError('NOT_FOUND')`.
- `'one'`: 그 거래만 `category`, `category_source: 'user'`로 update → `{ updated: 1 }`.
- `'merchant'`: `category_overrides`에 `{ user_id, merchant_key, category }`를 `onConflict: 'user_id,merchant_key'`로 upsert → 같은 사용자·같은 `merchant_key`의 모든 거래를 `category`, `category_source: 'user'`로 update(`.select('id')`로 개수) → `{ updated: n }`. override가 있으면 다음 업로드도 이 분류를 쓴다(1-ingest 분류 순서).
- 사용자 권한 client만 쓴다(admin 금지). DB 에러는 `AppError('INTERNAL')`로 바꾸고 원문은 버린다.
- 테스트: 두 scope, 없는 id → NOT_FOUND, 모든 쿼리에 `user_id = userId`가 들어가는지.

### 5. `src/app/api/transactions/[id]/route.ts` (+ `route.test.ts`)
```ts
export const PATCH = handler(
  { auth: 'user', consent: true, body: z.object({ category: z.enum(CATEGORIES), scope: z.enum(['one', 'merchant']) }) },
  async ({ user, body, params }) => setCategory(user!.id, params.id, body),
);
```
- `params.id`가 UUID가 아니면 `NOT_FOUND`. 테스트: 400(잘못된 카테고리), 404, 200 `{ updated }`, Origin 불일치 403.

### 6. 화면
- `src/app/(app)/transactions/page.tsx`: `searchParams` → `parseTxFilters` → `listTransactions` → 컴포넌트에 전달. `empty`면 `/upload`로. 로직 없음.
- `src/components/dashboard/tx-filters.tsx`: `<form method="get" action="/transactions">` — 월(`MonthPicker` 재사용, `basePath="/transactions"`), 카테고리 select, 카드 select, 검색어 input(최대 50자). JS 없이 동작.
- `src/components/dashboard/transaction-list.tsx` (client): props `{ groups, month, nextCursorHref }`. 날짜 헤더("9월 26일 (토)") + 행: 가맹점명, 카테고리 칩(버튼), 금액(`formatKRW`, 환불은 `−` + "환불"), 취소는 취소선 + "취소", `pending`은 "추정" 배지(`text-warning`), 할부는 "N개월 할부". [더 보기] 링크.
- `src/components/dashboard/category-sheet.tsx` (client): props `{ tx: { id; merchantRaw; category }, onClose }` → 15개 카테고리 선택 + [이번 건만] [같은 가맹점 모두] → `apiFetch(`/api/transactions/${id}`, { method: 'PATCH', body })` → 토스트 "분류를 바꿨어요" / "같은 가맹점 N건을 바꿨어요" → `router.refresh()`. 실패 시 `redirectPathForError`가 경로를 주면 이동, 아니면 `ApiError.message` 표시.
- 각 컴포넌트 `.test.tsx`: 그룹 렌더, 배지, 칩 클릭 → 시트, 두 버튼의 PATCH body(`apiFetch`를 `vi.mock`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 쓰기가 `handler()`를 거친 Route Handler에서만 일어나는가? GET(목록·필터)에는 부작용이 없는가?
   - 검색어가 `.or()`/raw 필터 문자열에 끼워지지 않는가?
   - 남의 거래 id로 PATCH하면 404이고 어떤 행도 바뀌지 않는가?
3. 결과에 따라 `phases/2-dashboard/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `setCategory`에서 admin client를 쓰거나 `user_id` 조건을 빼지 마라. 이유: RLS + 명시 조건의 이중 격리가 원칙이고, admin은 `server/admin.ts` 전용이다.
- Server Action(`"use server"`)으로 카테고리를 바꾸지 마라. 이유: 쓰기는 Route Handler + `handler()`만(ADR-001).
- 요청 body의 `userId`를 믿지 마라. 이유: 사용자 ID는 세션(`ctx.user.id`)에서만 온다.
- 로그에 가맹점명·금액·검색어를 남기지 마라. 이유: SafeLogger 규칙(AGENTS.md CRITICAL).
- `category_source`를 `'user'` 외의 값으로 바꾸지 마라. 이유: 사용자 수정 여부가 H4 지표와 이후 분류 우선순위의 근거다.
- 기존 테스트를 깨뜨리지 마라.
