# Step 6: landing-closing

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/UI_GUIDE.md` ("랜딩 예외": 전체 폭 `bg-accent` 섹션은 마지막 CTA 하나)
- `/docs/UX_GUIDE.md` §4 "S0 발견"(요금은 Free의 "첫 AI 리포트 1회 무료" 강조, 마지막 CTA로 막다른 끝 없애기)
- `/docs/design/landing-v1.html`의 `<!-- ⑥ 요금 -->`, `<!-- ⑦ FAQ -->`, `<!-- ⑧ 마지막 CTA -->` 부분과 `.plans`, `.plan*`, `.p-*`, `.faq-list`, `.final`, `.btn-invert`, `.btn-ghost` CSS (확정 시안)
- `/src/components/marketing/landing/*` (`LandingSection`, `LandingCta`) — step 1
- `/src/components/marketing/pricing-summary.tsx`, `faq.tsx`와 각 테스트
- `/src/lib/domain/pricing.ts` (`PRO_MONTHLY_KRW`), `/src/lib/domain/money.ts`

## 배경

랜딩의 마지막 세 섹션이다. 요금은 Free에서도 AI를 한 번 써 볼 수 있다는 점("첫 AI 리포트 1회 무료")을 가입 동기로 강조한다. 지금 랜딩은 FAQ에서 끝나 행동할 곳이 없으므로, 마지막에 초록 띠 CTA를 둔다.

## 작업

TDD로 진행한다.

### 1. `src/components/marketing/pricing-summary.tsx` 다시 쓰기 (이름 `PricingSummary`, props 없음 유지)
`<LandingSection id="pricing" tone="alt" labelledBy="pricing-heading">`:
- 머리말 `요금`, `h2#pricing-heading` `지출 정리는 무료, 더 깊은 분석은 Pro`, 오른쪽에 `요금 자세히` Text 링크(`/pricing`).
- 카드 2개(`md:grid-cols-2`, `rounded-md p-6`). 항목 앞에 체크 SVG(`text-accent`):
  - **Free**(`bg-bg border-line`): `₩0`(`text-4xl font-bold`) · `업로드와 AI 자동 분류` · `월별 대시보드` · `정기결제 건수와 합계` · `첫 AI 리포트 1회 무료`(마지막 항목만 `bg-accent-soft font-semibold text-ink rounded-md` 강조)
  - **Pro**(`bg-surface border-ink`): `formatKRW(PRO_MONTHLY_KRW)` + 작은 `/월` · `매달 AI 리포트` · `내 지출에 대해 채팅으로 묻기` · `여러 달 추이와 전월 비교` · `정기결제 전체 목록` · 아래 작은 글 `해외결제가 되는 카드(VISA·Mastercard)가 필요해요. 언제든 해지할 수 있어요.`

### 2. `src/components/marketing/faq.tsx` 고치기 (이름 `FAQ` 유지)
- `<LandingSection id="faq" labelledBy="faq-heading">` 안으로 옮기고 `max-w-3xl`로 폭을 줄인다. 기존 `details` 항목은 유지한다.
- 두 번째 자리에 항목 추가: `AI가 분류를 틀리면요?` → `거래를 눌러 카테고리를 바꿀 수 있어요. "같은 가맹점 모두"를 고르면 다음부터도 그 카테고리로 정리돼요.`
- `summary`에 `focus-visible` 표시가 있게 한다.

### 3. `src/components/marketing/landing/final-cta.tsx` (새 서버 컴포넌트)
```tsx
export function FinalCta(): JSX.Element
```
`<LandingSection id="final" tone="accent" labelledBy="final-heading">`:
- `h2#final-heading` `이번 달 지출, 파일 하나로 정리해 보세요` (`text-3xl md:text-5xl font-bold tracking-tight text-white`)
- 설명 `연동 없이 카드사에서 받은 이용내역 파일만 있으면 돼요. 첫 AI 리포트는 무료예요.` (`text-accent-soft`)
- 버튼: `LandingCta` `section="final"` — `무료로 시작`(`variant="invert"`, `cta="start"`, `/login?next=%2Fupload`), `예시 먼저 보기`(`variant="ghost"`, `cta="demo"`, `/demo`)
- 왼쪽 정렬(중앙 정렬 금지).

### 4. 테스트
- `pricing-summary.test.tsx`: 두 카드의 가격(`₩0`, `formatKRW(PRO_MONTHLY_KRW)`), 강조된 `첫 AI 리포트 1회 무료`, 해외결제 카드 안내, `/pricing` 링크.
- `faq.test.tsx`: 새 항목 포함 전체 질문 목록과 순서.
- `landing/final-cta.test.tsx`: 제목, 두 링크의 href·이름, 섹션에 `bg-accent`, `text-center`가 없다.
- `ui-guide.test.tsx`가 계속 통과해야 한다(렌더 목록에 `FinalCta`를 추가해도 좋다).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 금액은 `formatKRW`, 가격은 `PRO_MONTHLY_KRW`에서 오는가(하드코딩 금지)?
   - `bg-accent` 전체 폭 섹션이 `FinalCta` 하나뿐인가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `/pricing` 페이지(`PricingTable`)와 `PLAN_FEATURES`를 바꾸지 마라. 이유: 결제 화면은 이 phase의 범위가 아니다.
- 효과를 약속하는 문구("한 달에 N원 아껴요")를 쓰지 마라. 이유: 측정하지 않은 효과 주장은 과장 표시다.
- `(marketing)/page.tsx`의 섹션 순서를 바꾸거나 `FinalCta`를 넣지 마라. 이유: step 8에서 조립한다.
- 기존 테스트를 깨뜨리지 마라. 바뀐 문구에 맞춰 해당 컴포넌트 테스트를 고치는 것은 허용한다.
