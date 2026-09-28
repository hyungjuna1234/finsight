# Step 0: landing-data

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (레이어 규칙: `src/lib/**`는 순수 함수만. 금액은 정수 KRW, 월 경계는 KST)
- `/docs/UX_GUIDE.md` §4 "S0 발견" (랜딩 섹션 표)
- `/docs/UI_GUIDE.md` "랜딩 예외" (숫자는 `getLandingShowcase()`에서, 코드가 계산한 통계를 AI 결과라고 부르지 않는다)
- `/docs/design/landing-v1.html` (확정 시안. 숫자는 예시일 뿐이고, 이 step에서는 같은 **종류**의 값을 데모 데이터로 계산한다)
- `/src/lib/demo/fixtures.ts`와 `fixtures.test.ts` (`DEMO_TRANSACTIONS`, `DEMO_MONTHS`, `DEMO_TODAY`, `DEMO_INSIGHT`, `getDemoProPreview`)
- `/src/lib/analytics/month.ts` (`summarizeMonth`, `collapseCategories`, `MonthSummary`, `DailyTotal`)
- `/src/lib/analytics/compare.ts` (`compareMonths`, `MonthDelta.topIncreases`)
- `/src/lib/analytics/recurring.ts` (`detectRecurring`, `recurringSummary`)
- `/src/lib/analytics/insight-metrics.ts` (`buildInsightMetrics`의 `weekendShare`는 0–1 비율, `insightHasNumbers`)
- `/src/lib/domain/money.ts`, `/src/lib/domain/types.ts`, `/src/lib/domain/categories.ts`

## 배경

랜딩 페이지를 새로 만든다(phase `7-landing`). 랜딩의 모든 숫자·표·차트는 `/demo`와 같은 데모 데이터에서 계산해야 두 화면이 어긋나지 않는다. 이 step은 랜딩 컴포넌트가 props로 받을 데이터를 한 번에 만드는 순수 함수를 만든다. 화면 코드는 다음 step들이 만든다.

## 작업

TDD로 진행한다. 새 파일 `src/lib/demo/landing.ts`와 같은 폴더의 `landing.test.ts`를 만든다.

```ts
export type LandingCategory = Category | "기타";

export interface LandingSheetRow { date: string /* "09.02" 형식 MM.DD */; merchant: string; amount: KRW; category: Category }
export interface LandingCategoryBar { category: LandingCategory; amount: KRW; share: number /* 0–100 정수 */; width: number /* 가장 큰 막대 대비 0–100 */ }
export interface LandingWeekday { label: "월" | "화" | "수" | "목" | "금" | "토" | "일"; amount: KRW; height: number /* 가장 큰 요일 대비 0–100 */; weekend: boolean }
export interface LandingRecurringItem { label: string; amount: KRW; width: number /* 가장 큰 항목 대비 0–100 */ }

export interface LandingShowcase {
  month: YearMonth;            // DEMO_MONTHS[2]
  previousMonth: YearMonth;    // DEMO_MONTHS[1]
  total: KRW;                  // 그 달 spend
  count: number;               // 그 달 거래 건수(summary.count)
  sheetRows: LandingSheetRow[];
  categoryBars: LandingCategoryBar[];
  topCategory: { category: Category; amount: KRW; share: number };
  increase: { category: Category; previous: KRW; current: KRW; rate: number /* 반올림 정수 % */ } | null;
  weekend: { share: number /* 0–100 정수 */; days: LandingWeekday[] /* 월→일 7개 */ };
  recurring: { count: number; monthlyTotal: KRW; yearlyTotal: KRW; items: LandingRecurringItem[] };
  report: { netRate: number | null /* 전월 대비 net 변화율, 반올림 정수 % */; weekendShare: number; content: InsightContent };
  chat: { category: Category; amount: KRW; topMerchant: string; topMerchantCount: number } | null;
}

export function getLandingShowcase(): LandingShowcase
```

계산 규칙:
- 기존 함수를 재사용한다: `summarizeMonth`, `compareMonths`, `detectRecurring(DEMO_TRANSACTIONS, DEMO_TODAY)`, `recurringSummary`, `buildInsightMetrics`. 같은 계산을 새로 구현하지 마라.
- `sheetRows`: 그 달의 `kind === "spend"`이고 `status === "posted"`인 거래를 날짜순(같으면 id순)으로 보고, **카테고리가 서로 다른** 거래를 앞에서부터 골라 5행을 만든다. `merchant`는 `merchantRaw` 그대로 둔다.
- `categoryBars`: 금액 상위 5개 카테고리 + 나머지를 합친 `"기타"`. 나머지가 0이면 `"기타"`를 넣지 않는다. 상위 5개의 `share`는 각각 반올림하고, `"기타"`의 share는 `100 − 나머지 합`으로 해서 **합이 정확히 100**이 되게 한다. `"기타"`가 없으면 반올림 오차를 가장 큰 막대에 더해 합을 100으로 맞춘다.
- `topCategory`는 `categoryBars`의 첫 항목과 같은 카테고리·금액·share다.
- `increase`: `compareMonths(현재, 이전).topIncreases` 중 `diff > 0`이고 `previous > 0`인 첫 항목. `rate = Math.round(diff / previous * 100)`. 없으면 `null`.
- `weekend.share = Math.round(buildInsightMetrics(...).weekendShare * 100)`. `days`는 `summary.daily`를 요일별로 합친다. 요일은 `IsoDate`를 UTC 자정으로 해석해 구한다(`buildInsightMetrics`와 같은 방식). 토·일은 `weekend: true`.
- `recurring`: `detectRecurring` 결과를 `monthlyEstimate` 내림차순으로 최대 5개 `items`에 담는다. `label`은 `RecurringItem.label`이다. `yearlyTotal = monthlyTotal * 12`.
- `report.content`는 `DEMO_INSIGHT` 그대로다. `netRate`는 `compareMonths(...).netRate`를 %로 바꿔 반올림한다(원래 값이 비율인지 %인지 코드에서 확인하라). 없으면 `null`.
- `chat`: 그 달 `"카페·간식"` 카테고리가 있으면 그 카테고리, 없으면 `topCategory`. `amount`는 그 카테고리 합계다. `topMerchant`·`topMerchantCount`는 그 카테고리 거래를 `merchantKey`로 묶었을 때 건수가 가장 많은 곳의 label과 건수다. 해당 거래가 없으면 `null`.
- 모든 금액은 `toKRW`를 거친 정수다. 결과는 같은 입력에 항상 같다(모듈 수준에서 한 번 계산해 캐시해도 된다).

테스트(`landing.test.ts`):
- `categoryBars`의 share 합이 100이고, `width`의 최댓값이 100이며, `topCategory`가 첫 막대와 같다.
- `sheetRows`는 5행이고 카테고리가 모두 다르며, 날짜가 모두 `month`에 속한다.
- `increase`가 `compareMonths`의 결과와 일치한다(카테고리·previous·current).
- `weekend.days`는 월→일 7개이고, 토·일만 `weekend: true`이며, 금액 합이 그 달 `daily` 합과 같다.
- `recurring.monthlyTotal`이 `recurringSummary(detectRecurring(...)).monthlyTotal`과 같고 `yearlyTotal`이 12배다.
- `insightHasNumbers(report.content)`가 `false`다.
- 두 번 호출해도 결과가 같다(`toEqual`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/demo/landing.ts`가 next·react·server·services를 import하지 않는가?
   - 금액이 모두 정수 KRW인가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`getLandingShowcase`와 주요 필드 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `fixtures.ts`의 데모 데이터(`DEMO_TRANSACTIONS` 생성 규칙, `DEMO_INSIGHT`)를 바꾸지 마라. 이유: `/demo` 화면과 기존 테스트가 이 값에 기대고 있고, 랜딩은 같은 데이터를 보여 줘야 한다.
- 시안(`landing-v1.html`)의 예시 숫자(₩1,234,000, +38% 등)를 하드코딩하지 마라. 이유: 랜딩 숫자는 데모 데이터에서 계산해야 `/demo`와 맞는다.
- 컴포넌트나 페이지를 만들지 마라. 이유: 이 step은 데이터만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
