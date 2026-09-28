# Step 1: landing-kit

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (레이어 규칙: 컴포넌트는 표시 데이터를 props로만 받는다. 이벤트 props에 금액·가맹점·이메일 금지)
- `/docs/UI_GUIDE.md` (색 토큰 표, "애니메이션", **"랜딩 예외"** 전체)
- `/docs/UX_GUIDE.md` §4 "S0 발견"의 섹션 표(`section` 값), §8 `landing_cta`·`landing_section_view`
- `/docs/design/landing-v1.html` (확정 시안. `<style>`의 `@keyframes`, `.btn-*`, 섹션 배경 교대 방식을 참고)
- `/src/app/globals.css` (토큰과 `@theme inline`)
- `/src/components/dashboard/category-chart.tsx` (차트 색 `COLORS`)
- `/src/components/marketing/ui-guide.test.tsx` (마케팅 안티 슬롭 테스트. 지금은 `animate-`를 전부 금지한다)
- `/src/components/billing/checkout-button.tsx`와 테스트 (`@vercel/analytics`의 `track` 사용·mock 방식)
- `/src/lib/domain/money.ts` (`formatKRW`, `formatSignedKRW`의 부호 문자)
- `phases/7-landing/index.json`의 step 0 summary (`getLandingShowcase`)

## 배경

랜딩 섹션들(step 2~6)이 같이 쓸 토대를 만든다: 색 토큰, 1회용 애니메이션, 화면 진입 감지, 숫자 채우기, 이벤트를 보내는 CTA 링크, 섹션 틀. 이 step에서는 랜딩 페이지 자체를 바꾸지 않는다.

## 작업

TDD로 진행한다. 새 컴포넌트는 `src/components/marketing/landing/`에 두고, 테스트는 같은 폴더에 `X.test.tsx`로 둔다.

### 1. `src/app/globals.css`
- `:root`에 추가: `--line-strong: #879089`, `--mark: #cde8dd`, `--chart-muted: #c9d0cb`, `--up-on-dark: #ff907f`. `--spend-up`을 `#c43a2e`로 바꾼다. `@theme inline`에 각각 `--color-line-strong`, `--color-mark`, `--color-chart-muted`, `--color-up-on-dark`를 추가한다.
- `body`에 `word-break: keep-all; overflow-wrap: break-word;`를 추가한다. 이유: 한국어가 단어 중간에서 줄바꿈되는 것을 막는다.
- 별도 `@theme { ... }` 블록에 랜딩용 애니메이션과 `@keyframes`를 정의한다(Tailwind v4 방식, 클래스 `animate-landing-*`):
  - `--animate-landing-fade: landing-fade .3s ease-out both` (opacity 0→1)
  - `--animate-landing-pop: landing-pop .25s ease-out both` (opacity 0, scale .85 → 1)
  - `--animate-landing-rise: landing-rise .45s ease-out both` (opacity 0, translateY 10px → 0)
  - `--animate-landing-grow-x: landing-grow-x .55s cubic-bezier(.2,.7,.2,1) both` (scaleX 0→1)
  - `--animate-landing-grow-y: landing-grow-y .6s cubic-bezier(.2,.7,.2,1) both` (scaleY 0→1)
  - `--animate-landing-select: landing-select .2s steps(1) none` (from·to 모두 `box-shadow: inset 0 0 0 2px var(--accent)`)
- 이 애니메이션은 컴포넌트에서 **항상 `motion-safe:` 변형으로만** 쓴다. 지연은 inline `style={{ animationDelay }}`로 준다(CSP가 inline style을 허용한다).

### 2. 차트 색 공유: `src/lib/domain/chart-colors.ts`
```ts
export const CHART_COLORS: readonly string[]   // category-chart.tsx의 8색을 그대로 옮긴다
export const CHART_OTHER_COLOR = "#B3BBB6"      // "기타"
```
`category-chart.tsx`가 이 상수를 import하도록 바꾼다(동작은 그대로). 테스트: 8개이고 모두 `#RRGGBB` 형식이다.

### 3. `landing/use-reveal.ts` ("use client" 훅)
```ts
export function useReveal<T extends Element>(ref: RefObject<T | null>): boolean
```
- 마운트할 때 요소가 **이미 화면 안에 있으면**(top < window.innerHeight) 영원히 `false`다. 처음 화면은 서버가 그린 완성 상태 그대로 둔다.
- `prefers-reduced-motion: reduce`이거나 `IntersectionObserver`가 없으면 `false`다.
- 그 밖에는 `IntersectionObserver`(threshold 0)로 보다가 처음 들어오는 순간 `true`가 되고 관찰을 끊는다. 언마운트 때도 끊는다.

### 4. `landing/reveal.tsx` ("use client")
```tsx
export function Reveal({ children, className }: { children: ReactNode; className?: string }): JSX.Element
```
`<div className={"group " + className} data-in={revealed ? "true" : undefined}>`. 자식은 `motion-safe:group-data-[in=true]:animate-landing-grow-x` 같은 클래스로 막대를 한 번 키운다. `data-in`이 없으면 자식은 완성 상태로 보인다.

### 5. `landing/count-up.tsx` ("use client")
```tsx
export function CountUp({ value, format }: { value: number; format: "krw" | "percent" | "signed-percent" }): JSX.Element
```
- 처음 렌더(서버 포함)는 최종 값이다: `krw` → `formatKRW`, `percent` → `41%`, `signed-percent` → `+38%`(음수는 `formatSignedKRW`와 같은 마이너스 문자).
- `useReveal`이 `true`가 되면 750ms 동안 0에서 `value`까지 ease-out으로 올린다(`requestAnimationFrame`). 중간 값도 같은 형식으로 정수로 표시한다.
- 스크린리더용: 움직이는 숫자는 `aria-hidden="true"` span, 최종 값은 항상 `sr-only` span에 둔다.

### 6. `landing/landing-cta.tsx` ("use client")
```tsx
export type LandingSectionId = "hero" | "tiles" | "report" | "steps" | "trust" | "pricing" | "faq" | "final";
export function LandingCta({ href, cta, section, variant, children }: { href: string; cta: "start" | "demo"; section: LandingSectionId; variant: "primary" | "secondary" | "invert" | "ghost"; children: ReactNode }): JSX.Element
```
- `next/link`로 이동하고, 클릭 때 `track("landing_cta", { cta, section })`를 보낸다. props에 다른 값을 넣지 마라.
- 공통: `inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2`.
- `primary`: `bg-accent text-white hover:bg-accent-hover focus-visible:outline-accent`. `secondary`: `border border-line-strong bg-surface text-ink hover:bg-bg`. `invert`(초록 띠 위): `bg-surface text-accent hover:bg-accent-soft focus-visible:outline-white`. `ghost`(초록 띠 위): `border border-white/70 text-white hover:bg-accent-hover focus-visible:outline-white`.
- `LandingSectionId` 타입은 이 파일에서 export하고 다른 랜딩 컴포넌트가 import한다.

### 7. `landing/landing-section.tsx` (서버 컴포넌트)
```tsx
export function LandingSection({ id, tone = "plain", labelledBy, children }: { id: LandingSectionId; tone?: "plain" | "alt" | "accent"; labelledBy?: string; children: ReactNode }): JSX.Element
```
- `<section id={id} data-landing-section={id} aria-labelledby={labelledBy}>` 안에 `<div className="mx-auto w-full max-w-5xl px-4">`.
- 세로 여백 `py-14 md:py-20`. `plain` = 배경 없음(페이지 `bg-bg`), `alt` = `border-y border-line bg-surface`, `accent` = `bg-accent text-white`.

### 8. `src/components/marketing/ui-guide.test.tsx`
- `"animate-"` 금지를 다음으로 바꾼다: HTML에 나오는 모든 `animate-` 클래스는 `motion-safe:animate-landing-` 또는 `motion-safe:group-data-[in=true]:animate-landing-` 형태여야 한다(정규식으로 검사). 나머지 금지어(`backdrop-blur`, `bg-gradient`, `bg-clip-text`, `blur-3xl`, `rounded-2xl`, 보라 계열, "Powered by AI", ✨)는 그대로 둔다.
- 이 step에서는 렌더링 대상 컴포넌트 목록을 바꾸지 않는다.

테스트(jsdom): `IntersectionObserver`와 `matchMedia`를 mock한다.
- `Reveal`: 처음부터 화면 안이면 `data-in`이 생기지 않는다. 화면 밖에서 시작해 교차 콜백이 오면 `data-in="true"`가 된다. reduced motion이면 생기지 않는다.
- `CountUp`: 첫 렌더 텍스트가 최종 형식(`₩119,100`, `41%`, `+38%`)이고 `sr-only` 최종 값이 있다.
- `LandingCta`: href가 그대로이고, 클릭하면 `track`이 `("landing_cta", { cta, section })`로 한 번 불린다(`vi.mock("@vercel/analytics")`).
- `LandingSection`: `id`와 `data-landing-section`이 붙고, tone별 클래스가 적용된다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 애니메이션 클래스가 모두 `motion-safe:`로 걸려 있는가?
   - 이벤트 props가 `cta`·`section`뿐인가?
   - 컴포넌트가 데이터를 가져오지 않고 props만 받는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 컴포넌트·훅·토큰 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 새 의존성(framer-motion 등)을 추가하지 마라. 이유: AGENTS.md 규칙이고, CSS와 IntersectionObserver로 충분하다.
- 반복(`infinite`) 애니메이션, 스크롤 위치에 연동되는 연출, 호버 애니메이션을 만들지 마라. 이유: UI_GUIDE "랜딩 예외"는 1회 재생 세 가지만 허용한다.
- 요소를 `opacity-0`이나 `scale-0` 상태로 렌더링해 관찰자를 기다리게 하지 마라. 이유: 서버 렌더 결과가 곧 완성 상태여야 한다(JS가 없거나 캡처할 때도 내용이 보여야 한다).
- `(marketing)/page.tsx`, `hero.tsx` 등 기존 랜딩 섹션을 바꾸지 마라. 이유: 다음 step들의 범위다.
- 기존 테스트를 깨뜨리지 마라. `--spend-up` 값을 문자열로 검사하는 테스트가 있으면 새 값에 맞춘다.
