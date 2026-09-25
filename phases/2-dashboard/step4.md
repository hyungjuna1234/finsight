# Step 4: demo

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (레이어 규칙: "components는 props만 → `/demo`가 같은 컴포넌트를 정적 데이터로 재사용")
- `/docs/PRD.md` (전환 장치: `/demo`), `/docs/USER_FLOWS.md` (① 랜딩 → `/demo` → [내 데이터로 시작]), `/docs/UI_GUIDE.md`
- `/src/lib/analytics/month.ts`, `/src/lib/analytics/compare.ts`, `/src/lib/analytics/recurring.ts` (Step 0)
- `/src/lib/analytics/dashboard.ts` (`resolveMonth`, `buildDashboardModel`, `DashboardModel`), `/src/components/dashboard/*` (Step 1)
- `/src/lib/ingest/merchant.ts` (`normalizeMerchant`), `/src/lib/domain/types.ts`, `/src/lib/domain/categories.ts`
- `/src/lib/domain/routes.ts` (`PROTECTED_PREFIXES` — `/demo`가 없어야 한다), `/src/test/fixtures/statements.ts` (합성 데이터 작성 방식)

## 작업

로그인 없이 볼 수 있는 샘플 대시보드를 만든다. **DB·인증·AI 호출 없음.** 실제 대시보드와 같은 컴포넌트를 쓴다. TDD로 진행한다.

### 1. `src/lib/demo/fixtures.ts` (순수, 결정적)
```ts
export const DEMO_TODAY: IsoDate;                       // '2026-09-30'
export const DEMO_MONTHS: readonly YearMonth[];         // ['2026-07', '2026-08', '2026-09']
export const DEMO_TRANSACTIONS: readonly TxView[];
export const DEMO_INSIGHT: { headline: string; points: string[]; tips: string[] };
export function getDemoDashboard(month?: string | null): DashboardModel
export function getDemoProPreview(): { recurring: RecurringItem[]; recurringTotal: { count: number; monthlyTotal: KRW }; trend: TrendPoint[]; delta: MonthDelta }
```
- 3개월, 월 60~90건의 **현실적인 합성** 카드 거래. `Math.random` 금지 — 손으로 쓴 표나 코드 안의 시드 PRNG로 매번 같은 결과를 만든다. id는 `demo-0001`처럼 고정, `cardId`는 `demo-card-1`/`demo-card-2`.
- 반드시 포함: 정기결제 5개(OTT·음악 스트리밍·통신요금·헬스장·클라우드 저장소처럼 25~35일 간격, 같은 금액), 카페·편의점·배달·마트·교통·쇼핑 일상 지출, 환불 1건, 취소 1건, 해외 추정(`pending`, `foreignAmount`/`foreignCurrency`) 1건, 3개월 할부 1건. 9월은 8월보다 식비가 늘고 카페가 줄게 만들어 전월 비교가 의미 있게 보이게 한다.
- `merchantKey`는 `normalizeMerchant(merchantRaw)`로 만든다. 가맹점명에 개인 이름·전화번호·카드번호 같은 값을 넣지 않는다.
- `DEMO_INSIGHT`: 해요체, **숫자(0-9, 전각 숫자) 없이** 문장만(3-pro 인사이트 규칙과 같다). 투자·세무 조언 없음.
- `getDemoDashboard`: `resolveMonth(month, [...DEMO_MONTHS].reverse())` + `buildDashboardModel({ today: DEMO_TODAY })` — 배너가 뜨지 않아야 한다.
- `getDemoProPreview`: `detectRecurring(DEMO_TRANSACTIONS, DEMO_TODAY)`, `recurringSummary`, `monthlyTrend(…, DEMO_MONTHS)`, 9월 vs 8월 `compareMonths`.

### 2. `src/lib/demo/fixtures.test.ts`
- 모든 거래: `isCategory`, `isIsoDate`, `amountKrw`가 정수 ≥ 0, `DEMO_MONTHS` 안, id 중복 없음.
- 각 달 `summarizeMonth` → `count > 0`, `net > 0`, 9월 `pendingCount === 1`.
- `detectRecurring` 결과가 정기결제 5개를 모두 찾는다(가맹점 키로 검증).
- 환불·취소·할부·추정 건이 각각 존재. `DEMO_INSIGHT` 전체 문자열에 `/[0-9０-９]/`가 없다.
- `getDemoDashboard('2026-08').month === '2026-08'`, 잘못된 값 → `'2026-09'`, `uploadBannerMonth === null`. 두 번 호출 결과가 같다.

### 3. 컴포넌트 (각 `.test.tsx`)
- `src/components/marketing/demo-banner.tsx`: "샘플 데이터예요 · 실제 화면과 같아요" + Primary 버튼 [내 데이터로 시작] → `/login?next=%2Fupload`. 좌측 정렬.
- `src/components/marketing/demo-pro-preview.tsx`: props = `getDemoProPreview()` 반환 형태 + `insight`. "Pro 기능 미리보기" 제목 아래 정기결제 목록(가맹점·월 금액·다음 예상일), 월별 추이 목록(`formatSignedKRW`), 전월 대비(`+`/`−` 기호 + `text-spend-up`/`text-spend-down`), 인사이트 문장(일반 텍스트) + "지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요." 정적 미리보기이며 3-pro의 pro-views·insights step이 Pro 컴포넌트로 교체한다.
- `src/components/dashboard/dashboard-view.tsx` 수정: `showTransactionsLink?: boolean`(기본 `true`) prop 추가 — 데모에서는 `/transactions` 링크를 숨긴다(로그인 화면으로 튀지 않게). 기존 테스트에 케이스 추가.

### 4. `src/app/(marketing)/demo/page.tsx`
- `searchParams`(Promise)의 `month` → `getDemoDashboard(month)` → 상단 간단한 헤더(로고 → `/`, [내 데이터로 시작]) + `<DemoBanner />` + `<DashboardView data basePath="/demo" showTransactionsLink={false} proTeasers={<DemoProPreview … />} />`.
- `requireUser`·`createServerSupabase`·`@/server/*`를 import하지 않는다. 로직 없음.
- `src/lib/domain/routes.test.ts`에 `isProtectedPath('/demo') === false` 케이스가 없으면 추가한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `/demo`가 대시보드와 **같은** `DashboardView`·`SummaryTiles`·`CategoryChart`·`TopMerchants`를 쓰는가(복제 컴포넌트 없음)?
   - `/demo` 경로에서 서버 모듈·DB·Claude를 전혀 import하지 않는가? 빌드 env 없이 렌더되는가?
   - 데모 데이터에 실제 개인정보(실명·전화번호·카드번호)가 없는가?
3. 결과에 따라 `phases/2-dashboard/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`DemoProPreview`는 3-pro에서 교체할 정적 미리보기임을 명시)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 데모용으로 대시보드 컴포넌트를 복사하거나 분기 코드를 넣지 마라. 이유: "실제 화면과 같아요"가 약속이고, props-only 설계의 목적이 이 재사용이다.
- 데모 인사이트를 실행 시 Claude로 생성하지 마라. 이유: 비로그인 공개 페이지에서 AI 비용·남용이 생긴다. 미리 쓴 문장만 쓴다.
- 실제 명세서나 실제 사람의 거래를 fixture로 넣지 마라. 이유: 레포에 실데이터를 두지 않는다(CLAUDE.md, ADR-011).
- `/demo`를 로그인 보호 경로에 넣거나 `(app)` 그룹 아래에 두지 마라. 이유: 로그인 없는 전환 장치다.
- 기존 테스트를 깨뜨리지 마라.
