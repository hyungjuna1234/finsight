# Step 1: dashboard

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`, `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (레이어 규칙, queries 규칙, `transactions` 테이블)
- `/docs/USER_FLOWS.md` (① 거래 없음 → `/upload`, ③ 대시보드), `/docs/UI_GUIDE.md` (타일·차트·레이아웃·색)
- `/src/lib/analytics/month.ts`, `/src/lib/domain/month.ts`, `/src/lib/domain/money.ts` (Step 0 — `summarizeMonth`, `collapseCategories`, `formatMonthLabel`, `formatSignedKRW`)
- `/src/server/auth.ts` (`requireUser`, `requireConsent`), `/src/services/supabase/server.ts` (`createServerSupabase`), `/src/types/database.ts`
- `/src/app/(app)/layout.tsx` (로그인·동의 리다이렉트), `/src/components/upload/*` (1-ingest UI 스타일 참고)
- `/src/test/tx-factory.ts` (`makeTx`)
- `node_modules/next/dist/docs/`의 page `searchParams`(Promise) 문서, `node_modules/recharts`의 타입

## 작업

TDD로 진행한다(구현 파일마다 같은 폴더에 테스트 먼저. TDD guard는 **파일 단위**로 `X.test.ts(x)`를 확인한다).

### 1. `src/lib/analytics/dashboard.ts` (순수, 데모와 공유)
```ts
export interface DashboardModel { month: YearMonth; availableMonths: YearMonth[]; summary: MonthSummary; uploadBannerMonth: YearMonth | null }
export function resolveMonth(requested: string | null | undefined, available: YearMonth[]): YearMonth   // 유효하고 목록에 있으면 그 달, 아니면 최신 달
export function uploadBannerMonth(latest: YearMonth, today: IsoDate): YearMonth | null
export function buildDashboardModel(i: { txs: TxView[]; month: YearMonth; availableMonths: YearMonth[]; today: IsoDate }): DashboardModel
```
- `uploadBannerMonth`: `prev = prevMonth(toYearMonth(today))`. `latest < prev`면 `prev`, 아니면 `null` (예: 오늘 2026-10-03, 최신 8월 → `2026-09` → "9월 내역을 올릴 차례예요").
- `availableMonths`는 최신이 앞(내림차순).

### 2. `src/server/tx-rows.ts` (queries·actions 공용 로더)
```ts
import "server-only";
export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
export function toTxView(row: TxRow): TxView
export async function loadTxViews(sb: ServerSupabase, userId: string, range: { from: IsoDate; to: IsoDate }): Promise<TxView[]>
export async function loadDataMonthSpan(sb: ServerSupabase, userId: string): Promise<{ first: YearMonth; last: YearMonth } | null>
```
- 필요한 컬럼만 명시해 select한다(`identity_key` 등 제외). RLS가 격리하지만 인덱스를 타도록 `.eq('user_id', userId)`도 붙인다.
- PostgREST는 기본 1,000행까지만 준다. `loadTxViews`는 `.order('occurred_on').order('id').range()`로 **1,000행씩 끝까지** 읽는다(테스트: 1,000+N행 페이지).
- `loadDataMonthSpan`: `occurred_on` 오름차순·내림차순 `limit(1)` 두 번. 거래가 없으면 `null`.
- `@supabase/*` 타입을 직접 import하지 마라(ESLint). 타입은 위처럼 `createServerSupabase`에서 유도한다.

### 3. `src/server/queries/dashboard.ts`
```ts
import "server-only";
export type DashboardData = { state: 'empty' } | ({ state: 'ready' } & DashboardModel);
export async function getDashboard(month?: string): Promise<DashboardData>
export async function getHasTransactions(): Promise<boolean>
```
- 첫 줄 `const user = await requireUser();`, 이어서 `await requireConsent(user.id)`. 데이터는 `createServerSupabase()`(RLS)로만 읽는다.
- `loadDataMonthSpan` → 없으면 `{ state: 'empty' }`. 있으면 `monthsBetween(first, last)` 역순 → `resolveMonth` → 그 달 `loadTxViews` → `buildDashboardModel({ today: kstToday() })`.
- 반환값은 직렬화 가능한 plain 객체만(Date·Map·함수 금지).
- 테스트: `@/services/supabase/server`와 `@/server/auth`를 `vi.mock`. 비로그인 시 `UNAUTHENTICATED` 전파, 빈 데이터, 잘못된 `month`(`2026-13`, `abc`) → 최신 달, 배너 계산.

### 4. 컴포넌트 (props만 받는다, 각 파일에 `.test.tsx`)
- `src/components/ui/app-bar.tsx` (client): 로고 "FinSight"(→`/dashboard`) + 내비 `대시보드 /dashboard · 거래 /transactions · 업로드 /upload · 추이 /trends · 정기결제 /recurring · 인사이트 /insights · 채팅 /chat · 설정 /settings`. 현재 경로는 `usePathname()`으로 `aria-current="page"` 표시. 모바일은 가로 스크롤(`overflow-x-auto`). [로그아웃]은 `<form method="post" action="/auth/signout">`.
- `src/components/dashboard/month-picker.tsx`: props `{ month, availableMonths, basePath }` → `‹ 이전 달` / `2026년 9월` / `다음 달 ›` **링크**(`${basePath}?month=YYYY-MM`)와 `<details>` 안의 전체 달 링크 목록. 목록에 없는 이웃 달은 비활성 텍스트. JS 없이 동작.
- `summary-tiles.tsx`: props `{ summary }` → 타일 3개: 이번 달 지출(`formatSignedKRW(net)`), 환불(`formatKRW`), 거래 건수. `pendingCount > 0`이면 "추정 금액 N건 포함"(`text-warning`). 숫자는 `text-3xl font-semibold tabular-nums`, 데스크톱 3열·모바일 1열.
- `category-chart.tsx` (client, Recharts): props `{ items: CategoryTotal[] }` → `collapseCategories` 결과를 가로 막대로. 축은 `formatKRWShort`, 툴팁은 `formatKRW`, 채도 낮은 8색(포인트 색과 별도), 최초 1회 애니메이션만(`prefers-reduced-motion`이면 끔). 차트 아래에 같은 데이터의 목록(카테고리·금액·비율)을 함께 렌더한다 — jsdom에서는 `ResponsiveContainer` 크기가 0이라 막대가 그려지지 않으므로 **테스트는 이 목록을 검사**한다.
- `top-merchants.tsx`: props `{ items: MerchantTotal[] }` → 순위·가맹점·건수·금액. 카드 없이 구분선 목록.
- `upload-banner.tsx`: props `{ month }` → "9월 내역을 올릴 차례예요" + [업로드] 링크(`/upload`).
- `dashboard-view.tsx`: props `{ data: DashboardModel; basePath: string; proTeasers?: React.ReactNode }` → 배너 → 월 선택 → 타일 → 차트 → TOP5 → `/transactions?month=` 링크 순. `summary.count === 0`이면 "이 달에는 거래가 없어요". **`proTeasers` 슬롯**은 값이 있을 때만 `<section aria-label="Pro 미리보기">`로 렌더한다(3-pro가 채운다. 여기서 Pro 로직을 만들지 마라).
- 테스트는 `makeTx` + `summarizeMonth`로 만든 샘플 데이터로 문구·링크·`formatKRW` 표기를 검증한다.

### 5. 페이지·레이아웃
- `src/app/(app)/dashboard/page.tsx`: `searchParams`(Promise)에서 `month`를 읽어 `getDashboard` → `empty`면 `redirect('/upload')`, 아니면 `<DashboardView data basePath="/dashboard" />`. 로직 없음.
- `src/app/(app)/layout.tsx`: 기존 로그인·동의 리다이렉트는 그대로 두고 `<AppBar />` + `max-w-5xl px-4` 본문 래퍼를 추가한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `getDashboard`·`getHasTransactions`의 첫 줄이 `requireUser()`인가? admin client를 쓰지 않았는가?
   - 컴포넌트가 `@/server/*`·`@/services/*`를 import하지 않고 props만 받는가(`/demo`가 재사용한다)?
   - 금액 표시가 `formatKRW`/`formatKRWShort`/`formatSignedKRW`로만 되는가?
3. 결과에 따라 `phases/2-dashboard/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`DashboardView`의 `proTeasers` 슬롯, `tx-rows.ts` 헬퍼 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 페이지·컴포넌트에서 Supabase를 직접 부르거나 브라우저 Supabase client를 만들지 마라. 이유: 읽기는 RSC → `server/queries`만(CLAUDE.md CRITICAL, ADR-002).
- 월 선택을 클라이언트 state + fetch로 만들지 마라. 이유: `?month=` 링크 + RSC면 GET 부작용 없이 충분하고 `/demo`에서도 그대로 동작한다.
- `select('*')`로 거래를 읽지 마라. 이유: 필요 없는 컬럼(identity_key 등)까지 직렬화되어 클라이언트로 갈 수 있다.
- Pro 판단(`requirePro`, 전월 비교, 정기결제 목록)을 이 step에 넣지 마라. 이유: 3-pro의 범위다. 슬롯만 남긴다.
- 이모지·그라데이션·글래스 효과를 쓰지 마라. 이유: `docs/UI_GUIDE.md` 안티패턴.
- 기존 테스트를 깨뜨리지 마라.
