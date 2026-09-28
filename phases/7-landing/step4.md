# Step 4: landing-report

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (AI 출력 규칙, 투자·세무 조언 거절)
- `/docs/UI_GUIDE.md` ("랜딩 예외", "문구"의 AI 결과 아래 한 줄)
- `/docs/design/landing-v1.html`의 `<!-- ③ AI 리포트 -->` 부분과 `.report-*`, `.rc-*`, `.mk`, `.callouts`, `.chat`, `.msg`, `.sugs` CSS (확정 시안)
- `/src/lib/demo/landing.ts` (`report`, `chat`, `total`, `weekend`) — step 0
- `/src/components/marketing/landing/*` (`LandingSection`) — step 1
- `/src/components/pro/insight-card.tsx` (실제 리포트 카드 구성: headline, points, 실천 팁)
- `/src/components/ui/ai-disclaimer.tsx` (`AiDisclaimer`)
- `/src/lib/domain/chat.ts` (`CHAT_EXAMPLES`)
- `/src/lib/analytics/insight-metrics.ts` (리포트 문장에는 숫자가 없다: `insightHasNumbers`가 걸리면 다시 생성한다)

## 배경

AI 기능을 강조하는 섹션이다. 실제 제품 구조를 그대로 보여 준다: **숫자는 FinSight 서버가 계산하고, 문장은 AI가 숫자 없이 쓴다.** "AI가 숫자를 지어내지 않는다"가 신뢰 포인트다. 채팅은 Pro 기능이라 Pro 표시를 붙인다.

## 작업

TDD로 진행한다. 새 파일 `src/components/marketing/landing/report-showcase.tsx`(서버 컴포넌트)와 테스트.

```tsx
export function ReportShowcase({ showcase }: { showcase: LandingShowcase }): JSX.Element
```

`<LandingSection id="report" labelledBy="report-heading">`:
- 머리말 `AI 리포트`, `h2#report-heading` `숫자는 정확하게 계산하고, 설명은 AI가 쉽게 풀어 줘요`, 설명 `첫 AI 리포트는 무료예요. Pro에서는 매달 리포트를 받고, 내 지출에 대해 채팅으로 물어볼 수 있어요.`
- 본문 `grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-10`:

**왼쪽: 리포트 카드** (`rounded-md border border-line bg-surface p-5 pl-8`, 옅은 그림자 하나)
- 머리 `{M}월 AI 리포트`(h3) + 태그 `예시`.
- 번호 표시 ①(카드 왼쪽 여백에 작은 `bg-ink` 원, `aria-hidden`) + 지표 줄(`bg-bg rounded-md p-3`, `grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))]`): `{M}월 지출` `formatKRW(total)` · `지난달보다` `netRate`(양수 `+n%` `text-spend-up`, 음수 `text-spend-down`, `null`이면 이 칸을 뺀다) · `주말 비율` `{weekendShare}%`.
- 번호 ② + `report.content.headline`(굵게) + `points` 목록.
- 번호 ③ + `실천 팁` + `tips` 목록.
- 맨 아래 `AiDisclaimer`.
- 좋아요·아쉬워요 버튼은 넣지 않는다(눌러도 아무 일이 없는 가짜 버튼이 된다).

**오른쪽: 설명 + 채팅**
- 순서 있는 목록(번호 원 1·2·3이 보인다):
  1. `숫자는 FinSight가 직접 계산해요` — `올린 거래를 서버에서 더하고 나눠요. AI는 숫자를 만들지 않아요.`
  2. `문장은 AI가 써요` — `숫자 없이 한 달 흐름만 설명해요. 숫자가 섞이면 다시 써요.`
  3. `다음 달에 해 볼 일까지` — `줄이기 쉬운 지출과 점검할 정기결제를 짚어 줘요.`
- 채팅 예시 카드(`chat`가 `null`이면 그리지 않는다): 머리 `채팅` + `Pro` 태그(`bg-ink text-white`). 내 말풍선(오른쪽, `bg-accent-soft`) `카페에 한 달에 얼마 써?` — 단, `chat.category`가 `카페·간식`이 아니면 `{category}에 한 달에 얼마 써?`. AI 말풍선(왼쪽, `bg-bg`) `{M}월 {category}{은/는} {formatKRW(amount)}이에요. 가장 많이 간 곳은 {topMerchant}, {topMerchantCount}번이에요.`(금액은 `<strong>`). 조사 은/는은 카테고리 마지막 글자의 받침으로 고른다(`카페·간식은`, `식비는`). 이를 위해 순수 함수 `src/lib/domain/korean.ts`의 `withTopic(word: string): string`(받침 있으면 `은`, 없거나 한글이 아니면 `는`)을 만들고 같은 폴더에 테스트한다. 아래에 `CHAT_EXAMPLES[1]`, `CHAT_EXAMPLES[2]`를 알약 모양(`rounded-full border border-line text-accent text-xs`)으로 보여 준다. 알약은 링크나 버튼이 아니다.

테스트(`report-showcase.test.tsx`, `getLandingShowcase()` 사용):
- 제목, `{M}월 AI 리포트`, `예시` 태그, headline·points·tips가 모두 보인다.
- 지표 줄에 `formatKRW(total)`과 `{weekendShare}%`가 있다. `netRate`가 `null`인 입력이면 `지난달보다` 칸이 없다.
- `AiDisclaimer` 문구가 있다.
- 설명 목록 3개 제목이 순서대로 있다.
- 채팅 카드에 `Pro` 태그와 금액이 있고, `chat: null`이면 채팅 카드가 없다.
- 섹션 안에 `button` 요소가 없다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 서버 컴포넌트이고 props만 쓰는가?
   - 금액은 `formatKRW`, 증감색은 UI_GUIDE(증가 빨강·감소 파랑)를 따르는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실제 AI를 호출하거나 `src/services/*`를 import하지 마라. 이유: 랜딩은 데모 데이터로 그린 예시다. AI 호출은 비용과 동의가 필요하다.
- 리포트 문장을 새로 지어내지 마라. `DEMO_INSIGHT`(`showcase.report.content`)만 쓴다. 이유: 실제 AI 출력 규칙(숫자 없음)을 따르는 검증된 예시다.
- `InsightCard`를 고치지 마라. 이유: 앱의 실제 리포트 화면이 쓰는 컴포넌트다. 랜딩 카드는 별도로 그린다.
- `(marketing)/page.tsx`에 이 섹션을 넣지 마라. 이유: step 8에서 조립한다.
- 기존 테스트를 깨뜨리지 마라.
