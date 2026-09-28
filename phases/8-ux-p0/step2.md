# Step 2: journey-query

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: 읽기는 Server Component → `src/server/queries/*`, queries 함수의 첫 줄은 `requireUser()`. 모든 테이블 RLS)
- `/docs/UX_GUIDE.md` §5
- `/docs/ARCHITECTURE.md` (queries 규칙, `insights` 테이블)
- `/src/server/queries/dashboard.ts`와 `dashboard.test.ts` (`getDashboard`, `getProPanel`, mock 방식)
- `/src/server/queries/insights.ts` (`insights` 테이블을 `user_id`·`month`로 읽는 방식)
- `/src/server/auth.ts` (`requireUser`, `requireConsent`, `getPlan` → `isPro`, `freeInsightAvailable`)
- `/src/lib/domain/journey.ts` — step 0

## 배경

시작 체크리스트와 "화면당 포인트 색 버튼 하나"(B1·B2)를 정하려면 대시보드가 `Journey`를 받아야 한다. 플랜과 이번 달 리포트 존재 여부는 서버에서만 알 수 있으므로 query를 하나 추가한다.

## 작업

TDD로 진행한다. `src/server/queries/dashboard.ts`에 추가한다.

```ts
export async function getJourney(input: { month: YearMonth; monthsWithData: number; staleMonth: YearMonth | null }): Promise<Journey>
```
- 첫 줄 `requireUser()`, 이어서 `requireConsent(user.id)`.
- `getPlan(user.id)`로 `isPro`·`freeInsightAvailable`을 얻는다.
- Pro일 때만 `insights`에서 `user_id = user.id`이고 `month = input.month`인 행이 있는지 센다(`select("month", { count: "exact", head: true })`). Free이면 조회하지 않고 `false`다. 조회 에러는 `AppError("INTERNAL")`로 바꾼다(에러 상세를 로그·응답에 남기지 않는다).
- `buildJourney({ isPro, monthsWithData, freeInsightAvailable, staleMonth, hasInsightThisMonth })`를 돌려준다.

테스트(`dashboard.test.ts`의 기존 mock 방식):
- Free이면 `insights`를 조회하지 않고, `freeInsightAvailable`에 따라 체크리스트가 바뀐다.
- Pro이고 이번 달 리포트가 없으면 `primary: "pro_insight"`, 있으면 `null`.
- `staleMonth`가 있으면 `primary: "stale_upload"`.
- 로그인하지 않았으면 `requireUser`의 에러가 그대로 나간다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 함수의 첫 줄이 `requireUser()`인가?
   - admin client를 쓰지 않고 사용자 세션 client(RLS)로만 읽는가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `getDashboard`·`getProPanel`의 반환 형태를 바꾸지 마라. 이유: 대시보드·데모가 쓰고 있다. 새 정보는 새 함수로 준다.
- 페이지·컴포넌트를 바꾸지 마라. 이유: step 4의 범위다.
- 기존 테스트를 깨뜨리지 마라.
