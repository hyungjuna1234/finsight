# Step 0: ux-logic

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (레이어 규칙: `src/lib/**`는 순수 함수만)
- `/docs/UX_GUIDE.md` §4 "S5 Aha"(한 줄 요약), **§5 "다음 단계 장치 — 시작 체크리스트"**(타입·완료 조건·`primary` 우선순위), §6 문구 사전("N월 지출")
- `/src/lib/analytics/dashboard.ts`와 테스트 (`DashboardModel`, `buildDashboardModel`, `uploadBannerMonth`)
- `/src/lib/analytics/month.ts` (`MonthSummary`, `collapseCategories`)
- `/src/lib/domain/korean.ts`와 테스트 (`withTopic`)
- `/src/lib/domain/month.ts` (`formatMonthLabel(month, "short")` → `9월`), `/src/lib/domain/money.ts` (`formatKRW`)
- `/src/lib/demo/fixtures.ts` (`getDemoDashboard`가 `buildDashboardModel`을 쓴다)

## 배경

UX_GUIDE 백로그 P0(B1~B6)를 구현하는 phase다. 이 step은 화면이 쓸 순수 로직 두 가지를 만든다.
1. **시작 체크리스트(B2):** "다음에 뭘 하지?"에 답하는 장치다. 새 테이블 없이 이미 있는 값으로 계산한다. `primary`는 화면에서 포인트 색 버튼을 가질 단 하나의 다음 단계다.
2. **한 줄 요약(B5):** 대시보드 첫 도착의 Aha를 한 문장으로 준다. AI가 아니라 서버 집계다.

## 작업

TDD로 진행한다.

### 1. `src/lib/domain/journey.ts` (새 파일) + `journey.test.ts`
```ts
export interface JourneyInput {
  isPro: boolean;
  monthsWithData: number;         // 거래가 있는 달 범위의 달 수 (availableMonths.length)
  freeInsightAvailable: boolean;  // Free 첫 리포트 무료가 남았나
  staleMonth: YearMonth | null;   // 올릴 차례인 달 (DashboardModel.uploadBannerMonth)
  hasInsightThisMonth: boolean;   // 보고 있는 달의 리포트가 있나(Pro만 의미 있음)
}
export type StepKey = "signup" | "first_upload" | "three_months" | "first_insight";
export type JourneyPrimary = "stale_upload" | StepKey | "pro_insight" | "pro_upgrade";
export interface ChecklistItem { key: StepKey; done: boolean; progress?: { now: number; goal: number } }
export interface Journey { checklist: ChecklistItem[] | null; primary: JourneyPrimary | null }
export function buildJourney(input: JourneyInput): Journey
```
- 체크리스트(Free만): `signup` 항상 완료, `first_upload` = `monthsWithData ≥ 1`, `three_months` = `monthsWithData ≥ 3`(`progress: { now: min(monthsWithData, 3), goal: 3 }`), `first_insight` = `!freeInsightAvailable`. Pro이거나 네 항목이 모두 완료면 `checklist: null`.
- `primary` 우선순위(위가 먼저): ① `staleMonth` 있음 → `"stale_upload"` ② Free이고 체크리스트 미완료 → 첫 미완료 항목 키 ③ Pro이고 `!hasInsightThisMonth` → `"pro_insight"` ④ Free이고 체크리스트 완료 → `"pro_upgrade"` ⑤ 그 외 `null`.
- 테스트: 우선순위 다섯 경우, 체크리스트 완료 조건 경계값(`monthsWithData` 0·1·2·3·5), Pro의 `checklist: null`, 모두 완료한 Free의 `pro_upgrade`, `stale`이 다른 모든 것보다 먼저인 것.

### 2. `src/lib/domain/korean.ts`에 추가
```ts
export function withSubject(word: string): string   // 받침 있으면 "이", 없거나 한글이 아니면 "가" (식비가, 카페·간식이)
```
`withTopic`과 같은 받침 판정을 공유하도록 정리한다. 테스트 추가.

### 3. `src/lib/analytics/headline.ts` (새 파일) + `headline.test.ts`
```ts
export function monthHeadline(summary: MonthSummary): string | null
```
- 거래가 없으면(`count === 0`) `null`.
- `net ≤ 0`이면 `{M}월에는 환불이 더 많았어요.`
- 그 밖에는 `{M}월에 {formatKRW(net)} 썼어요. {카테고리}{이/가} {share}%로 가장 많아요.` — 카테고리는 `collapseCategories(summary.byCategory)`에서 금액이 가장 큰 것(“기타”로 묶인 것이 1위면 그 다음 실제 카테고리를 쓴다), `share`는 카테고리 합계 대비 반올림 정수 %. 카테고리가 없으면 첫 문장만.
- `{M}월`은 `formatMonthLabel(summary.month, "short")`.

### 4. `src/lib/analytics/dashboard.ts`
- `DashboardModel`에 `headline: string | null`을 추가하고 `buildDashboardModel`이 `monthHeadline(summary)`로 채운다. 데모(`getDemoDashboard`)도 자동으로 채워진다.
- 기존 테스트의 기대값에 `headline`을 반영한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 새 파일이 모두 `src/lib`에 있고 next·react·server·services를 import하지 않는가?
   - 금액 표시는 `formatKRW`만 쓰는가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`buildJourney`, `JourneyPrimary`, `monthHeadline`, `withSubject`, `DashboardModel.headline` 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- DB 테이블·마이그레이션을 추가하지 마라. 이유: UX_GUIDE §5는 "새 테이블 없이 이미 있는 값에서 계산"으로 정했다(MVP 단순함).
- 체크리스트 "닫기" 상태나 localStorage를 만들지 마라. 이유: 닫기 버튼은 두지 않는다(MVP). 다 끝나면 저절로 사라진다.
- 한 줄 요약에 AI를 쓰지 마라. 이유: 첫 도착에 바로 떠야 하고, 숫자는 서버 집계여야 한다.
- 컴포넌트·페이지를 바꾸지 마라. 이유: 이 step은 순수 로직만 다룬다.
- 기존 테스트를 깨뜨리지 마라. `DashboardModel`에 필드가 늘어 생기는 기대값 보강은 허용한다.
