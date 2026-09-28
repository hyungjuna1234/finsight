# Step 5: landing-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Claude에는 최소 데이터만 — 매핑 = 마스킹한 헤더+샘플 5행, 분류 = 가맹점명, 인사이트 = 집계값, 채팅 도구 = 30행 이하)
- `/docs/UI_GUIDE.md` ("랜딩 예외": AI에 보내는 데이터는 기능별로 정확히 적는다. 아이콘 규칙)
- `/docs/UX_GUIDE.md` §4 "S3 파일 확보"(최근 3개월, 이용내역 ≠ 청구서, 휴대폰 안내)
- `/docs/design/landing-v1.html`의 `<!-- ④ 3단계 -->`, `<!-- ⑤ 데이터 흐름 -->` 부분과 `.flow`, `.f-*`, `.issuers`, `.dflow`, `.dnode`, `.fields`, `.proc`, `.send`, `.darrow`, `.never`, `.timeline` CSS (확정 시안)
- `/src/components/marketing/landing/*` (`LandingSection`) — step 1
- `/src/components/marketing/how-it-works.tsx`와 테스트, `/src/components/marketing/trust-points.tsx`와 테스트
- `/src/lib/domain/guides.ts` (`ISSUER_GUIDES`의 `name`)
- `/src/server/actions/chat.ts`, `/src/lib/analytics/group.ts`의 `toSearchRows` (채팅이 AI에 보내는 거래 필드: 이용일·가맹점·금액·유형·카테고리·추정 여부, 최대 30건)

## 배경

랜딩 네 번째·다섯 번째 섹션이다. "시작하는 법"은 실제 절차 3단계를 그림으로 보여 준다. "데이터 흐름"은 무엇이 어디까지 가는지를 다이어그램으로 보여 준다. 지금 랜딩의 "AI에는 가맹점명과 집계값만 보내요"는 사실과 다르다(Pro 채팅은 거래 30건 이하를 보낸다). 새 다이어그램은 기능별로 정확히 적는다.

## 작업

TDD로 진행한다.

### 1. `src/components/marketing/how-it-works.tsx` 다시 쓰기 (서버 컴포넌트, 이름 `HowItWorks` 유지)
`<LandingSection id="steps" tone="alt" labelledBy="how-heading">`:
- 머리말 `시작하는 법`, `h2#how-heading` `3단계면 첫 대시보드를 볼 수 있어요`.
- `<ol>` 3단계(`md:grid-cols-3`). 각 단계: 번호 원(`border-accent text-accent`) + 인라인 SVG 아이콘(`strokeWidth 1.5`, 24px, `aria-hidden`) + h3 + 설명. `md` 이상에서 단계 사이를 점선(`border-t border-dashed border-line-strong`)으로 잇는다.
  1. 모니터 아이콘 · `카드사 홈페이지에서` · `'이용내역 조회' 메뉴로 가요. 청구서가 아니라 이용내역이에요.` (`이용내역`에 `bg-mark` 강조)
  2. 파일 아이콘 · `최근 3개월을 엑셀로 저장` · `기간은 최근 3개월로 골라요. 석 달 치면 정기결제까지 찾아 드려요.` (`최근 3개월`에 `bg-mark` 강조)
  3. 막대 아이콘 · `FinSight에 올리기` · `AI가 열을 맞추고 카테고리를 나눠요. 같은 형식은 다음부터 확인 없이 올라가요.`
- 카드사 이름 칩: `ISSUER_GUIDES`의 `name`에서 끝의 `카드`를 뺀 이름(`신한`, `삼성`, `현대`, `KB국민`, `롯데`, `하나`)을 테두리 칩으로 두고, 끝에 `카드사별 받는 법 →` 링크(`/guide`, `text-accent`).
- 한 줄 안내: `휴대폰만 있다면 PC에서 열 링크를 복사해 카카오톡 '나와의 채팅'에 붙여 두세요.` (`text-sm text-muted`)
- 카드사 로고 이미지는 쓰지 않는다.

### 2. `src/components/marketing/landing/data-flow.tsx` (새 서버 컴포넌트)
```tsx
export function DataFlow(): JSX.Element
```
`<LandingSection id="trust" labelledBy="trust-heading">`:
- 머리말 `데이터`, `h2#trust-heading` `AI에는 기능에 필요한 만큼만 보내요`.
- 노드 3개 + 화살표 2개(`lg:grid-cols-[.8fr_auto_.9fr_auto_1.3fr]`, 좁은 화면은 세로로 쌓고 화살표를 아래로 돌린다):
  1. `내 이용내역 파일` — 칩 `이용일`, `가맹점`, `금액`, `카드번호`, `승인번호`(카드번호·승인번호는 옅은 빨강 칩).
  2. `FinSight 서버`(작게 `서울 리전`) — 체크 목록 `카드번호와 긴 숫자를 가려요`, `합계와 비율은 여기서 계산해요`, `원본 파일은 여기에만 있어요`.
  3. `AI에 보내는 것`(`border-ink` 강조) — 표(`th scope="row"`):
     - `열 맞추기` → `가린 샘플 5행`
     - `카테고리 분류` → `가맹점명`
     - `AI 리포트` → `합계·비율 같은 집계값`
     - `채팅` + `Pro` 태그 → `질문과, 답에 필요한 거래 30건 이하(날짜·가맹점·금액)`
- `AI에 보내지 않아요`: × 아이콘(`text-spend-up`) + `카드번호`, `이름·이메일`, `원본 파일`.
- 타임라인: 가로선 양 끝 점, 왼쪽 `올린 날`, 오른쪽 `90일 · 원본 자동 삭제`, 아래 `그 전에도 언제든 업로드별 삭제, 전체 삭제, 탈퇴를 할 수 있어요.`

### 3. 빌드 유지
- `trust-points.tsx`는 이 step에서 지우지 않는다(`page.tsx`가 아직 쓴다. step 8에서 지운다).
- `HowItWorks`의 export 이름과 props(없음)를 유지해 `page.tsx`와 `ui-guide.test.tsx`가 그대로 빌드되게 한다.

### 4. 테스트
- `how-it-works.test.tsx`: 제목, 단계 3개의 h3가 순서대로, `최근 3개월`·`이용내역` 강조, 카드사 이름 6개, `/guide` 링크, 휴대폰 안내.
- `landing/data-flow.test.tsx`: 표 4행의 기능·보내는 것이 정확히 위 문구와 같다. `채팅` 행에 `Pro`와 `30건`이 있다. `AI에 보내지 않아요` 3항목, 타임라인 문구. 섹션 안에 `가맹점명과 집계값만`이라는 문구가 없다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 다이어그램의 "AI에 보내는 것"이 AGENTS.md의 최소 데이터 규칙·`chat.ts`의 실제 동작과 일치하는가?
   - 아이콘이 인라인 SVG이고 `strokeWidth 1.5`인가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- "AI에는 가맹점명과 집계값만 보내요"처럼 채팅을 빼먹은 요약을 쓰지 마라. 이유: Pro 채팅은 거래 30건 이하를 보낸다. 사실과 다른 개인정보 안내가 된다.
- 동의 문구(`consent.ts`)와 개인정보 처리방침은 이 step에서 고치지 마라. 이유: step 7의 범위다.
- 카드사 로고·상표 이미지를 넣지 마라. 이유: 상표 문제와 CSP.
- `(marketing)/page.tsx`의 섹션 순서를 바꾸지 마라. 이유: step 8에서 조립한다.
- 기존 테스트를 깨뜨리지 마라. 바뀐 문구에 맞춰 `how-it-works.test.tsx`를 고치는 것은 허용한다.
