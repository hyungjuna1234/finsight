# Step 3: landing-tiles

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/UI_GUIDE.md` ("랜딩 예외": 코드가 계산한 통계를 "AI가 찾았다"고 쓰지 않는다. 차트 텍스트 대안)
- `/docs/UX_GUIDE.md` §3-5 접근성(차트 옆 텍스트 대안), §4 "S0 발견"
- `/docs/design/landing-v1.html`의 `<!-- ② 찾아내는 것 -->` 부분과 `.tiles`, `.tile`, `.rec`, `.cmp`, `.week`, `.stack`, `.legend` CSS (확정 시안)
- `/src/lib/demo/landing.ts` — step 0
- `/src/components/marketing/landing/*` (`LandingSection`, `Reveal`, `CountUp`) — step 1
- `/src/lib/domain/chart-colors.ts`, `/src/lib/domain/money.ts`, `/src/lib/domain/month.ts`(`formatMonthLabel`)

## 배경

랜딩 두 번째 섹션은 "한 달 내역에서 찾아내는 것"을 큰 숫자 4개와 미니 그래프로 보여 주는 인포그래픽이다. 이 숫자들은 AI가 아니라 FinSight 코드가 계산하므로 **"AI"라는 말을 쓰지 않는다**(과장 표시 방지). Pro 기능에는 Pro 표시를 붙여 무료 범위를 오해하지 않게 한다.

## 작업

TDD로 진행한다. 새 파일 `src/components/marketing/landing/spend-tiles.tsx`(서버 컴포넌트)와 테스트.

```tsx
export function SpendTiles({ showcase }: { showcase: LandingShowcase }): JSX.Element
```

`<LandingSection id="tiles" tone="alt" labelledBy="tiles-heading">`:
- 머리말 `한 달 내역에서 찾아내는 것`(`text-sm font-semibold text-accent`), `h2#tiles-heading` `새는 돈이 숫자로 보여요`(`text-2xl md:text-4xl font-bold tracking-tight`), 설명 `아래는 예시예요. 내 파일을 올리면 내 숫자로 바뀌어요.`
- 타일 격자 `grid gap-4 md:grid-cols-2`. 각 타일은 `<article className="rounded-md border border-line bg-bg p-6">`이고, `Reveal`로 감싸 화면에 들어올 때 막대가 한 번 자란다. 큰 숫자는 `CountUp`, 크기 `text-4xl md:text-5xl font-bold tracking-tight tabular-nums`, 앞에 붙는 작은 말(`월`, 카테고리 이름)은 `text-xl font-semibold text-body`.

타일 네 개(순서 고정):
1. **잊고 있던 정기결제** — 오른쪽 위 태그 `목록은 Pro`. 숫자 `월 {CountUp krw monthlyTotal}`. 보조 `{count}건 · 1년이면 {formatKRW(yearlyTotal)}`. 그래프: `recurring.items`를 한 줄씩(이름 · 가로 막대 `width%` · `formatKRW(amount)` 오른쪽 정렬).
2. **지난달보다 늘어난 지출** — 태그 `Pro`(어두운 배경 `bg-ink text-white`). 숫자 `{category} {CountUp signed-percent rate}`, 숫자 색 `text-spend-up`. 보조 `{이전 달 short} {formatKRW(previous)} → {이번 달 short} {formatKRW(current)}`. 그래프: 세로 막대 2개(이전 달 `bg-chart-muted`, 이번 달은 카테고리 색이고 늘어난 몫(`(current−previous)/current`)을 위쪽에 `bg-spend-up`으로 덧칠), 막대 아래에 달 이름과 금액. `increase`가 `null`이면 이 타일을 그리지 않는다.
3. **주말에 몰린 지출** — 숫자 `{CountUp percent share}`. 보조 `토·일 이틀에 한 달 지출의 {share}%를 썼어요`. 그래프: 월~일 세로 막대 7개(`height%`), 주말은 `bg-accent`와 굵은 요일 글자, 평일은 `bg-chart-muted`.
4. **가장 많이 쓴 카테고리** — 숫자 `{category} {CountUp percent share}`. 보조 `{M}월 지출 {formatKRW(total)} 중 {formatKRW(amount)}`. 그래프: `categoryBars`를 한 줄로 쌓은 100% 막대(간격 2px) + 범례(`이름 share%`).

막대 움직임: 가로 막대는 `origin-left motion-safe:group-data-[in=true]:animate-landing-grow-x`, 세로 막대는 `origin-bottom motion-safe:group-data-[in=true]:animate-landing-grow-y`, 지연은 i×0.05s(inline). 막대 크기 자체는 항상 최종 값이다.

접근성: 그래프 도형은 `aria-hidden="true"`로 두고, 값은 보이는 글(목록·범례·금액)로 이미 전달한다. 요일 그래프에는 `sr-only` 목록(요일과 금액)을 둔다.

테스트(`spend-tiles.test.tsx`, `getLandingShowcase()` 사용):
- 제목과 설명, 타일 4개(또는 `increase: null`이면 3개)가 보인다.
- 정기결제 타일에 `formatKRW(monthlyTotal)`(sr-only 포함)와 `recurring.items` 이름이 모두 있다. `목록은 Pro` 태그가 있다.
- 증가 타일에 `Pro` 태그와 `+{rate}%`가 있다.
- 요일 그래프에 7개 막대가 있고 토·일만 주말 클래스다.
- 범례 항목 수가 `categoryBars` 길이와 같다.
- 섹션 안 어디에도 "AI"라는 글자가 없다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 서버 컴포넌트이고, 클라이언트 부분은 `Reveal`·`CountUp`뿐인가?
   - 금액은 모두 `formatKRW`로 표시하는가?
   - 모든 `animate-` 클래스가 `motion-safe:`로 걸려 있는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 섹션에 "AI가 찾았어요" 같은 표현을 쓰지 마라. 이유: 정기결제·전월 비교·주말 비율은 코드가 계산한다. AI 결과라고 부르면 과장 표시가 된다.
- Recharts를 쓰지 마라. 이유: UI_GUIDE "랜딩 예외"의 성능 규칙. HTML·CSS 막대로 충분하다.
- 시안의 예시 숫자를 하드코딩하지 마라. 이유: 숫자는 `showcase`에서 온다.
- `(marketing)/page.tsx`에 이 섹션을 넣지 마라. 이유: step 8에서 순서를 한 번에 조립한다.
- 기존 테스트를 깨뜨리지 마라.
