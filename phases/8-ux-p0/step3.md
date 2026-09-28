# Step 3: pro-teasers

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Pro 기능은 서버의 `requirePro()`로만 허용 — 이 step은 표시만 바꾼다)
- `/docs/UX_GUIDE.md` §3-4 "대비"(accent 채움 버튼은 화면당 1개), §4 "S7 전환", §10 B1
- `/docs/UI_GUIDE.md` 버튼(Primary·Secondary·Text), "잠긴 Pro 영역"
- `/src/components/pro/pro-lock.tsx`, `pro-teasers.tsx`, `comparison-teaser.tsx`, `trend-teaser.tsx`와 각 테스트
- `/src/components/chat/chat-teaser.tsx`와 테스트
- `/src/app/(app)/insights/page.tsx`, `/src/app/(app)/recurring/page.tsx`, `/src/app/(app)/trends/page.tsx`, `/src/app/(app)/chat/page.tsx` (ProLock·티저를 쓰는 곳)
- `/src/components/ui/track.ts`, `/src/components/ui/tracked-link.tsx` — step 1
- `/src/lib/domain/journey.ts` — step 0

## 배경

Free 대시보드에는 포인트 색(accent) 채움 버튼이 최대 5개 있다: 올릴 차례 배너, ProLock ×3(정기결제·전월 비교·추이), 리포트 만들기. UX_GUIDE는 "화면당 accent 버튼 하나 = 그 화면의 다음 단계"로 정했다(B1).
- 대시보드 안의 Pro 잠금은 **Text 링크 "Pro에서 보기"**로 낮춘다.
- 전환 버튼 "Pro 시작하기"는 `journey.primary === "pro_upgrade"`일 때만 Pro 영역에 **하나** 둔다.
- 첫 리포트 무료 버튼은 시작 체크리스트(step 4)로 옮긴다.
- 반대로 `/recurring`·`/trends`·`/chat`·`/insights`처럼 **잠금 자체가 그 화면의 다음 단계**인 곳은 지금처럼 Primary 버튼을 유지한다.

## 작업

TDD로 진행한다.

### 1. `src/components/pro/pro-lock.tsx`
```tsx
export function ProLock({ message = "Pro에서 전체 목록을 볼 수 있어요", from, variant = "button" }: { message?: string; from: ProTeaserFrom; variant?: "button" | "link" }): JSX.Element
```
- `variant="button"`: 지금 모양 그대로(문구 + Primary `Pro 시작하기`, 왼쪽 정렬).
- `variant="link"`: 문구 + Text 링크 `Pro에서 보기 →`(`text-sm text-accent underline-offset-4 hover:underline`). 채움 배경 없음.
- 둘 다 `TrackedLink`로 `/pricing`에 가며 `pro_teaser_click { from }`을 보낸다.
- 클라이언트 경계는 `TrackedLink` 안에만 둔다(`ProLock`에 `"use client"`를 붙이지 않는다).

### 2. 티저
- `ComparisonTeaser`: 대시보드 전용이므로 `ProLock variant="link" from="comparison"`.
- `TrendTeaser({ variant = "button" }: { variant?: "button" | "link" })`: `ProLock from="trend"`에 variant를 넘긴다. `/trends` 페이지는 기본값(button) 그대로.
- `ChatTeaser`: `ProLock from="chat"`(button).
- `/insights` 페이지의 `ProLock`에 `from="insight"`, `/recurring` 페이지의 `ProLock`에 `from="recurring"`을 넣는다(페이지에는 이 prop 추가만 한다).

### 3. `src/components/pro/pro-teasers.tsx`
```tsx
export function ProTeasers({ panel, primary = false }: { panel: ProPanel; primary?: boolean }): JSX.Element
```
- Free: 정기결제 합계 아래 `ProLock variant="link" from="recurring"`, `ComparisonTeaser`, `TrendTeaser variant="link"`, 채팅 예시 질문 링크는 그대로 둔다.
- Free의 **"첫 AI 리포트는 무료예요 / 리포트 만들기" 블록을 지운다**(시작 체크리스트 ④로 옮긴다).
- `primary`가 `true`이면 Free 영역 맨 위에 한 줄 설명 `추이·전월 비교·정기결제 목록·AI 리포트를 매달 받아요`와 Primary `Pro 시작하기`(`TrackedLink`, `/pricing`, `next_step_click { step: "pro_upgrade" }`)를 하나 둔다. `false`이면 이 버튼이 없다.
- Pro(`kind: "pro"`) 분기는 바꾸지 않는다.

### 4. 테스트
- `ProLock`: variant별 모양(button은 `bg-accent`, link는 `bg-accent` 없음), href `/pricing`, 클릭 시 `pro_teaser_click`과 `from`.
- `ProTeasers`(Free): `bg-accent` 클래스를 가진 링크·버튼이 `primary=false`이면 0개, `primary=true`이면 정확히 1개다. "리포트 만들기"가 없다.
- `TrendTeaser` 기본값은 button, `variant="link"`는 link.
- 기존 티저·페이지 테스트가 새 props에 맞게 통과한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `/recurring`·`/trends`·`/chat`·`/insights`의 잠금 화면은 여전히 Primary 버튼인가?
   - 대시보드 Pro 영역의 accent 채움 요소가 `primary`일 때만 1개인가?
   - 이벤트 props가 `from`/`step`뿐인가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `requirePro()`나 API의 권한 검사를 건드리지 마라. 이유: 이 step은 표시만 바꾼다. Pro 허용은 서버에서만 한다.
- `/pricing?from=` 복귀 흐름(B11)을 만들지 마라. 이유: P1 백로그라 이 phase 범위 밖이다.
- 대시보드 페이지(`(app)/dashboard/page.tsx`)에서 `primary`를 넘기는 연결은 하지 마라. 이유: step 4에서 `getJourney`와 함께 연결한다(이 step에서는 기본값 `false`로 동작한다).
- 기존 테스트를 깨뜨리지 마라. 바뀐 모양에 맞춰 티저 테스트를 고치는 것은 허용한다.
