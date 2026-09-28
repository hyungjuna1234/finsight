# Step 2: landing-hero

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/UI_GUIDE.md` ("랜딩 예외", 버튼·금액 규칙)
- `/docs/UX_GUIDE.md` §4 "S0 발견"
- `/docs/design/landing-v1.html`의 `<!-- ① 히어로 -->` 부분과 `.hero*`, `.stage`, `.sheet`, `.grid`, `.chip`, `.bars`, `.ai-card` CSS, `@media (prefers-reduced-motion:no-preference)` 안의 `.stage.play` 타이밍 (확정 시안)
- `/src/lib/demo/landing.ts` (`getLandingShowcase`, `LandingShowcase`) — step 0
- `/src/components/marketing/landing/*` (`LandingSection`, `LandingCta`, `LandingSectionId`) — step 1
- `/src/lib/domain/chart-colors.ts`, `/src/app/globals.css`의 `animate-landing-*`·새 토큰 — step 1
- `/src/components/marketing/hero.tsx`와 `hero.test.tsx`, `/src/components/marketing/ui-guide.test.tsx`
- `/src/app/(marketing)/page.tsx`

## 배경

지금 히어로는 제목과 버튼 두 개뿐이라 밋밋하다. 확정 시안의 히어로는 **변환 스토리**다. 로드 때 약 4초 동안 한 번, 엑셀 이용내역 행 → AI가 카테고리 열을 채움 → 카테고리 막대 → 어두운 AI 리포트 카드 순으로 드러난다. 모든 내용은 서버가 그린 HTML이고, 움직임은 CSS뿐이다.

## 작업

TDD로 진행한다.

### 1. `src/components/marketing/landing/hero-stage.tsx` (서버 컴포넌트)
```tsx
export function HeroStage({ month, total, count, rows, bars, insight }: {
  month: YearMonth; total: KRW; count: number;
  rows: LandingSheetRow[]; bars: LandingCategoryBar[];
  insight: { headline: string; increase: LandingShowcase["increase"] };
}): JSX.Element
```
`<figure aria-label="이용내역 파일이 AI 리포트로 바뀌는 과정 예시" className="grid gap-2.5">` 안에 차례로:
1. **시트** (`rounded-md border border-line bg-surface`, 옅은 그림자 하나): 파일 탭 `카드이용내역_{YYYY-MM}.xlsx`(파일 아이콘 SVG), `table-fixed` 표. 열 머리 A·B·C·D와 행 번호 칸(엑셀 모양), 머리 행 `이용일 · 가맹점 · 이용금액 · AI 분류`("AI 분류"만 `text-accent`), 그 아래 `rows` 5행(날짜, `merchant`(말줄임), `formatKRW` 없이 천 단위 쉼표 금액 오른쪽 정렬 `tabular-nums`, 카테고리 칩).
2. **칩**: 점 + 카테고리 이름, `rounded-full text-xs font-semibold`. 색은 그 카테고리의 막대 색과 같게 한다(`bars` 안 순서의 `CHART_COLORS`, 없으면 `CATEGORIES` 순서로 `CHART_COLORS`, "기타"는 `CHART_OTHER_COLOR`). 배경은 그 색 15%, 글자는 그 색 60% + ink(`color-mix`, CSS 변수 `--c`를 inline style로 넘긴다).
3. **흐름 문구**: 아래 화살표 SVG + `카테고리별로 모아요 · {M}월 {count}건` (`text-xs text-muted`).
4. **막대 카드**(`rounded-md border border-line bg-surface p-4`): 머리 `{M}월 지출`과 `formatKRW(total)`(`text-xl font-bold tabular-nums`), 그 아래 `bars` 막대(이름 · 트랙+채움 `width: {width}%` · `{share}%`).
5. **AI 리포트 카드**(`rounded-md bg-ink p-4 text-white`): 윗줄 `AI 리포트` / `예시`(`text-white/70 text-xs`), 헤드라인(`insight.headline`), `increase`가 있으면 `▲ {rate}%`(`text-up-on-dark text-3xl font-bold tabular-nums`) + `{category} · 지난달보다`(`text-white/80 text-sm`).
6. 캡션 `예시 데이터로 만든 화면이에요` (`text-xs text-muted`).

움직임(모두 `motion-safe:`, 지연은 inline `animationDelay`): 데이터 행 `animate-landing-fade` 0.1s + i×0.06s → D칸 `animate-landing-select` 1.0s + i×0.2s → 칩 `animate-landing-pop` 1.05s + i×0.2s → 흐름 문구 `animate-landing-fade` 2.2s → 막대 카드 `animate-landing-fade` 2.3s → 채움 `origin-left animate-landing-grow-x` 2.45s + i×0.07s → AI 카드 `animate-landing-rise` 3.2s.

### 2. `src/components/marketing/hero.tsx` 다시 쓰기
```tsx
export function Hero({ showcase }: { showcase: LandingShowcase }): JSX.Element
```
`<LandingSection id="hero" labelledBy="hero-heading">` 안에 `grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] lg:items-center lg:gap-14`, 왼쪽 글, 오른쪽 `HeroStage`. 모바일은 글 → 스테이지 순서로 쌓인다. 문구는 그대로 쓴다:
- 머리말 `연동 없는 AI 지출 정리` (`text-sm font-semibold text-accent`)
- `h1#hero-heading`: `월급이 어디로 새는지, 파일 하나로 AI가 찾아 드려요`. `어디로 새는지`는 `<mark>`로 감싸 형광펜 밑줄을 긋는다: `bg-[linear-gradient(transparent_60%,var(--color-mark)_60%,var(--color-mark)_94%,transparent_94%)] text-inherit`. 크기 `text-[2rem] leading-[1.18] sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] font-bold tracking-[-0.035em] text-ink`.
- 부제 `카드사 홈페이지에서 받은 이용내역 파일만 올리면, AI가 카테고리를 나누고 새는 돈을 짚어 줘요.` (`text-base sm:text-lg text-body`)
- 버튼: `LandingCta`(`section="hero"`) — `무료로 시작`(primary, `cta="start"`, href `/login?next=%2Fupload`), `로그인 없이 예시 보기`(secondary, `cta="demo"`, href `/demo`)
- 신뢰 줄(작은 초록 점 + 글, 줄이 바뀌어도 어색하지 않게 `flex flex-wrap gap-x-4 gap-y-1`): `계좌·카드 연동 없음` · `원본은 90일 뒤 자동 삭제` · `첫 AI 리포트 무료`
- `HeroStage`에는 `showcase`의 `month`·`total`·`count`·`sheetRows`·`categoryBars`와 `{ headline: showcase.report.content.headline, increase: showcase.increase }`를 넘긴다.

### 3. 빌드 유지
- `src/app/(marketing)/page.tsx`: `<Hero showcase={getLandingShowcase()} />`로만 바꾼다(섹션 순서·틀은 step 8에서 바꾼다).
- `ui-guide.test.tsx`: `Hero` 렌더에 `showcase={getLandingShowcase()}`를 넘긴다.

### 4. 테스트 (`hero.test.tsx`, `landing/hero-stage.test.tsx`)
- h1의 접근 가능한 이름이 정확히 `월급이 어디로 새는지, 파일 하나로 AI가 찾아 드려요`이고, `mark` 안에 `어디로 새는지`가 있다.
- 링크: `무료로 시작` → `/login?next=%2Fupload`, `로그인 없이 예시 보기` → `/demo`. 히어로 루트에 `text-center`가 없다.
- 신뢰 줄 3개 문구가 보인다.
- `HeroStage`: 데이터 행이 `sheetRows` 길이만큼이고 가맹점 이름이 보인다. 막대 수가 `categoryBars` 길이와 같다. `increase`가 있으면 `▲ {rate}%`가 보이고, `null`이면 증감 줄이 없다. `예시` 표시와 캡션이 있다.
- 모든 `animate-` 클래스가 `motion-safe:`로 시작한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `HeroStage`가 서버 컴포넌트이고(`"use client"` 없음) props만 쓰는가?
   - 금액 표시에 `formatKRW`를 쓰는가(시트의 원시 금액 칸만 예외)?
   - `ui-guide.test.tsx`를 통과하는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이미지 파일·스톡 사진·일러스트를 넣지 마라. 이유: UI_GUIDE "랜딩 예외"는 인라인 SVG와 실제 데이터 모양의 인포그래픽만 허용한다. CSP도 외부 이미지를 막는다.
- 히어로에 Recharts나 클라이언트 JS를 쓰지 마라. 이유: 첫 화면이 가벼워야 하고(LCP), 시퀀스는 CSS만으로 된다.
- "Powered by AI" 같은 배지, 그라데이션 글자, 글로우를 넣지 마라. 이유: AI 슬롭 금지 목록.
- `e2e/landing.spec.ts`는 이 step에서 고치지 마라. 이유: 랜딩 전체를 조립하는 step 8에서 한 번에 고친다.
- 기존 테스트를 깨뜨리지 마라. 바뀐 히어로 문구에 맞춰 `hero.test.tsx`를 고치는 것은 허용한다.
