# Step 1: event-kit

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (로그·이벤트에 거래·가맹점·금액·이메일 금지)
- `/docs/UX_GUIDE.md` **§8 "측정"** (이벤트 이름·props·지표 표)
- `/src/components/billing/checkout-button.tsx`와 테스트, `/src/components/pro/insight-feedback.tsx` (`@vercel/analytics`의 `track`을 쓰는 기존 방식과 mock 방식)
- `/src/components/marketing/landing/landing-cta.tsx` (이벤트를 보내는 링크의 기존 예)
- `/src/lib/domain/errors.ts` (`ErrorCode`), `/src/lib/domain/guides.ts` (`IssuerId`), `phases/8-ux-p0/index.json`의 step 0 summary (`JourneyPrimary`)

## 배경

UX_GUIDE §8의 퍼널 이벤트(B6)를 여러 컴포넌트에서 보낸다. 이벤트 이름과 props를 한곳에서 타입으로 묶어, 금액·가맹점 같은 값이 실수로 들어가지 않게 한다. 이 step은 도구만 만들고, 실제 이벤트는 step 3~7에서 붙인다.

## 작업

TDD로 진행한다.

### 1. `src/components/ui/track.ts`
```ts
export type ProTeaserFrom = "recurring" | "comparison" | "trend" | "chat" | "insight";
export interface AnalyticsEvents {
  demo_cta: Record<string, never>;
  consent_done: Record<string, never>;
  guide_open: { issuer: IssuerId; where: "upload" | "guide" };
  link_copy: Record<string, never>;
  upload_done: { auto: boolean; first: boolean };
  upload_error: { code: ErrorCode | "NETWORK" };
  mapping_changed: Record<string, never>;
  category_edit: { scope: "one" | "merchant" };
  next_step_click: { step: JourneyPrimary };
  insight_generate: { free: boolean };
  pro_teaser_click: { from: ProTeaserFrom };
}
export function trackEvent<E extends keyof AnalyticsEvents>(name: E, props: AnalyticsEvents[E]): void
```
- `track(name, props)`를 부르되 예외를 삼킨다(분석이 실패해도 화면은 계속 동작해야 한다).
- props 값은 enum 문자열과 불리언만 허용된다(타입으로 보장). 빈 props(`{}`)는 `track(name)`처럼 props 없이 보내도 된다.

### 2. `src/components/ui/tracked-link.tsx` ("use client")
```tsx
export function TrackedLink<E extends keyof AnalyticsEvents>({ href, event, eventProps, className, children }: { href: string; event: E; eventProps: AnalyticsEvents[E]; className?: string; children: ReactNode }): JSX.Element
```
`next/link`로 이동하고 클릭할 때 `trackEvent(event, eventProps)`를 한 번 보낸다.

### 3. 테스트 (`vi.mock("@vercel/analytics")`)
- `trackEvent`가 이름과 props를 그대로 넘긴다. `track`이 예외를 던져도 `trackEvent`는 던지지 않는다.
- `TrackedLink`: href가 그대로이고, 클릭하면 이벤트가 한 번 나간다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 이벤트 props 타입에 숫자·자유 문자열(금액, 가맹점, 파일명, 이메일, 사용자 ID)이 없는가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 `track` 호출(`checkout_start`, `checkout_pro_active`, `insight_feedback`, `landing_cta`, `landing_section_view`)을 바꾸지 마라. 이유: 이미 동작하고 테스트가 있다. 이 step은 새 이벤트용 도구만 만든다.
- 새 의존성을 추가하지 마라. 이유: AGENTS.md 규칙이고 `@vercel/analytics`가 이미 있다.
- 이벤트를 실제 컴포넌트에 붙이지 마라. 이유: step 3~7의 범위다.
- 기존 테스트를 깨뜨리지 마라.
