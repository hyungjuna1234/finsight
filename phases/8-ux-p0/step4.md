# Step 4: dashboard-view

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (`page.tsx`에는 로직을 두지 않는다. 컴포넌트는 props로만 받는다)
- `/docs/UX_GUIDE.md` §3-1 계층 구조, §4 "S5 Aha"·"S8 재방문", **§5 시작 체크리스트**, §6 문구 사전, §10 B2·B5
- `/docs/UI_GUIDE.md` (카드·버튼·금액·타이포)
- `/src/components/dashboard/dashboard-view.tsx`, `summary-tiles.tsx`, `upload-banner.tsx`, `top-merchants.tsx`와 각 테스트
- `/src/app/(app)/dashboard/page.tsx`, `/src/app/(marketing)/demo/page.tsx` (둘 다 `DashboardView`를 쓴다)
- `/src/app/(app)/insights/page.tsx` (`SummaryTiles`를 쓴다)
- 이전 step: `/src/lib/domain/journey.ts`, `/src/lib/analytics/headline.ts`, `DashboardModel.headline`(step 0), `/src/components/ui/tracked-link.tsx`(step 1), `getJourney`(step 2), `ProTeasers`의 `primary` prop(step 3)
- `/e2e/public-pages.spec.ts` (데모에서 "이번 달 지출"을 찾는 줄)

## 배경

대시보드 첫 도착(Aha)의 주인공은 숫자다. 지금은 요약 타일 3개가 모두 같은 크기라 지출이 환불·건수와 같은 무게이고, 라벨 "이번 달 지출"은 지난 달을 볼 때 틀린 말이다(B5). 숫자를 본 다음에는 시작 체크리스트가 다음 한 걸음을 알려 준다(B2). 올릴 차례 배너는 재방문 장치다(S8).

## 작업

TDD로 진행한다.

### 1. `src/components/dashboard/start-checklist.tsx` (새 서버 컴포넌트)
```tsx
export function StartChecklist({ journey, month }: { journey: Journey; month: YearMonth }): JSX.Element | null
```
- `journey.checklist`가 `null`이면 아무것도 그리지 않는다.
- 제목 `시작하기 · 4단계 중 {완료 수}단계 완료`(`text-base font-semibold`), 번호가 있는 목록 4개. 완료 항목은 체크 아이콘(인라인 SVG, `text-accent`)과 `text-muted`.
  - ① `가입하기`
  - ② `첫 카드 내역 올리기`
  - ③ `석 달 치 채우기 · {now}/3달` + 보조 `정기결제와 전월 비교를 찾아 드려요` — 행동 `지난 내역 올리기` → `/upload`
  - ④ `첫 AI 리포트 받기 · 무료` — 행동 `리포트 만들기` → `/insights?month={month}`
- 완료되지 않은 항목의 행동은 모두 `TrackedLink`(`next_step_click { step: 키 }`). `journey.primary`와 같은 항목만 Primary 버튼 모양이고, 나머지는 Text 링크다.
- 닫기 버튼은 없다.

### 2. `src/components/dashboard/upload-banner.tsx`
- 문구: `{M}월 내역을 올릴 차례예요. 같은 카드사 형식이면 확인 없이 바로 올라가요.` 버튼: `{M}월 내역 올리기`(Primary, `TrackedLink` → `/upload`, `next_step_click { step: "stale_upload" }`).
- 배경 `bg-accent-soft` 위 글자는 `text-body` 이상을 쓴다(대비 규칙).

### 3. `src/components/dashboard/summary-tiles.tsx`
- 첫 타일 라벨을 `{formatMonthLabel(summary.month, "short")} 지출`로 바꾼다(`9월 지출`). 숫자 `text-3xl font-semibold`.
- 환불·거래 건수 타일의 숫자는 `text-xl font-semibold`로 낮춘다. 추정 금액 안내는 그대로 둔다.
- `/insights` 페이지도 이 컴포넌트를 쓰므로 같은 모양이 된다.

### 4. `src/components/dashboard/dashboard-view.tsx`
```tsx
export function DashboardView({ data, basePath, proTeasers, showTransactionsLink = true, journey }: { ...; journey?: Journey }): JSX.Element
```
위에서 아래 순서: (올릴 차례 배너) → 제목·월 선택 → **한 줄 요약**(`data.headline`, `text-base text-body`, 없으면 생략) → 요약 타일 → 카테고리 → TOP5 → `showTransactionsLink`이면 TOP5 아래에 `카테고리가 틀리면 거래를 눌러 바꿀 수 있어요`(`text-sm text-muted`) → 거래 전체 보기 → `journey`가 있으면 `StartChecklist` → Pro 영역.
- 데모(`/demo`)는 `journey`를 넘기지 않으므로 체크리스트가 없다.

### 5. `src/app/(app)/dashboard/page.tsx` (조립만)
- `const journey = await getJourney({ month: data.month, monthsWithData: data.availableMonths.length, staleMonth: data.uploadBannerMonth });`
- `DashboardView`에 `journey`를, `ProTeasers`에 `primary={journey.primary === "pro_upgrade"}`를 넘긴다.

### 6. e2e
- `e2e/public-pages.spec.ts`의 데모 검사를 `이번 달 지출` → `9월 지출`로 바꾼다(데모 최신 달은 2026-09). 한 줄 요약 문장(`9월에 ` 로 시작)이 보이는지도 검사한다.

### 7. 테스트
- `StartChecklist`: checklist null이면 렌더링 없음. 완료 수 제목, `{now}/3달`, `primary` 항목만 `bg-accent`, 클릭 시 `next_step_click`.
- `UploadBanner`: 새 문구·버튼 이름·이벤트.
- `SummaryTiles`: `9월 지출` 라벨, 지출은 `text-3xl`, 나머지는 `text-xl`.
- `DashboardView`: 요소 순서(한 줄 요약이 타일보다 먼저, 체크리스트가 TOP5 뒤·Pro 영역 앞), `journey` 없으면 체크리스트 없음.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
npm run e2e -- e2e/public-pages.spec.ts   # 샌드박스에서 실행 불가면 summary에 "e2e는 하네스 밖에서 확인 필요"라고 적고 completed로 둔다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 대시보드 한 화면에 accent 채움 버튼이 1개 이하인가(배너, 체크리스트 primary, Pro 시작하기 중 `journey.primary`에 해당하는 하나)?
   - `page.tsx`에 조립 외의 로직이 없는가?
   - 금액은 `formatKRW`/`formatSignedKRW`만 쓰는가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (e2e 실행 여부를 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 빈 달 행동 추가·`not-found`/`error` 페이지(B13), 문구 사전 전체 적용(B8)을 하지 마라. 이유: P1 백로그라 이 phase 범위 밖이다.
- 한 줄 요약을 컴포넌트에서 계산하지 마라. 이유: `DashboardModel.headline`(서버·lib 계산)을 props로 받는다.
- 데모 페이지에 체크리스트를 넣지 마라. 이유: 데모는 로그인하지 않은 사람의 예시라 "다음 단계"가 없다.
- 기존 테스트를 깨뜨리지 마라. 바뀐 라벨·순서에 맞춰 테스트를 고치는 것은 허용한다.
