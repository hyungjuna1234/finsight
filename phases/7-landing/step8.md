# Step 8: landing-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (`page.tsx`에는 로직을 두지 않는다. 이벤트 props에 금액·가맹점·이메일 금지)
- `/docs/UX_GUIDE.md` §4 "S0 발견"의 섹션 표(순서와 `section` 값), §8 `landing_cta`·`landing_section_view`
- `/docs/UI_GUIDE.md` "랜딩 예외"
- `/docs/design/landing-v1.html` (확정 시안 전체 순서)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` (Next 16의 `opengraph-image.tsx`, 로컬 폰트를 `readFile`로 읽는 예시)
- 이전 step 산출물: `/src/lib/demo/landing.ts`, `/src/components/marketing/landing/*`(`LandingSection`, `LandingCta`, `Reveal`, `CountUp`, `HeroStage`, `SpendTiles`, `ReportShowcase`, `DataFlow`, `FinalCta`), `/src/components/marketing/{hero,how-it-works,pricing-summary,faq}.tsx`
- `/src/app/(marketing)/page.tsx`, `/src/app/(marketing)/layout.tsx`, `/src/app/layout.tsx`
- `/src/components/marketing/trust-points.tsx`와 테스트, `/src/components/marketing/ui-guide.test.tsx`
- `/e2e/landing.spec.ts`, `/playwright.config.ts`

## 배경

step 0~7에서 만든 섹션을 확정 시안 순서로 조립해 랜딩을 완성한다. 섹션 노출 이벤트와 카카오톡·SNS 공유용 미리보기 이미지(OG 이미지)도 붙인다.

## 작업

TDD로 진행한다.

### 1. `src/components/marketing/landing/section-view-tracker.tsx` ("use client")
```tsx
export function SectionViewTracker(): null
```
- 마운트 때 `[data-landing-section]` 요소를 모두 `IntersectionObserver`(threshold 0.4)로 보고, 섹션마다 처음 보일 때 한 번 `track("landing_section_view", { section })`을 보낸다. `section`은 `data-landing-section` 값이고, 허용 값(`LandingSectionId`)이 아니면 보내지 않는다. 다 보냈거나 언마운트되면 관찰을 끊는다.
- `IntersectionObserver`가 없으면 아무것도 하지 않는다.
- 테스트(jsdom, IO·`@vercel/analytics` mock): 교차 콜백이 두 번 와도 섹션당 한 번만 보낸다. 모르는 값은 보내지 않는다.

### 2. `src/app/(marketing)/page.tsx`
- `metadata`: title `FinSight | 파일 하나로 보는 AI 지출 정리`, description `연동 없이 카드사 이용내역 파일만 올리면 AI가 카테고리를 나누고 새는 돈을 짚어 줘요.`
- 본문(로직 없이 조립만): `const showcase = getLandingShowcase();` 다음 `<main>` 안에 `Hero` → `SpendTiles` → `ReportShowcase` → `HowItWorks` → `DataFlow` → `PricingSummary` → `FAQ` → `FinalCta` → `<SectionViewTracker />`.
- 기존의 `mx-auto max-w-5xl space-y-8 px-4` 틀은 없앤다. 폭과 여백은 각 `LandingSection`이 맡아 배경이 화면 끝까지 닿게 한다.

### 3. 정리
- `trust-points.tsx`와 `trust-points.test.tsx`를 지운다(데이터 흐름도로 대체됐다). 다른 곳에서 import하지 않는지 확인한다.
- `ui-guide.test.tsx`의 렌더 목록을 새 랜딩 전체로 바꾼다: `SiteHeader`, `Hero`, `SpendTiles`, `ReportShowcase`, `HowItWorks`, `DataFlow`, `PricingSummary`, `FAQ`, `FinalCta`, `SiteFooter`(`showcase={getLandingShowcase()}`).

### 4. OG 이미지: `src/app/opengraph-image.tsx`
- 루트에 둬서 모든 페이지에 적용한다. route group(`(marketing)`) 안에 두지 마라. 이유: route group 안의 메타데이터 이미지 경로는 헷갈리기 쉽고, 앱 화면 링크가 공유돼도 같은 카드가 나오면 충분하다.
- `export const alt = "FinSight — 파일 하나로 보는 AI 지출 정리"`, `size = { width: 1200, height: 630 }`, `contentType = "image/png"`.
- 폰트: 모듈 최상위에서 `readFile(join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"))`와 `Pretendard-SemiBold.otf`를 읽어 `ImageResponse`의 `fonts`에 넘긴다. 한글이 깨지지 않게 하는 필수 조건이다.
- 그림(배경 `#F6F7F5`, 여러 자식을 가진 div는 모두 `display: flex`):
  - 왼쪽: `FinSight`(28px, `#0E6B55`), 제목 두 줄 `월급이 어디로 새는지,` / `파일 하나로 AI가 찾아 드려요`(60px Bold, `#18201C`), 부제 `연동 없이 카드 이용내역 파일만 올리면 돼요`(28px, `#3B4540`).
  - 오른쪽: 어두운 카드(`#18201C`, 둥근 모서리 16, 폭 약 420): `AI 리포트 · 예시`(22px, `#AEB8B2`), `getLandingShowcase().report.content.headline`(30px SemiBold, 흰색), `increase`가 있으면 `+{rate}%`(64px Bold, `#FF907F`)와 `{category} · 지난달보다`(24px, `#C9D1CC`).
  - `▲` 같은 기호 문자는 쓰지 않는다(폰트에 없으면 네모로 나온다).
- 요청 시점 API(`headers()`, `cookies()`)를 쓰지 않아 빌드 때 정적으로 만들어지게 한다. `metadataBase`는 이 step에서 넣지 않는다(env 지연 검증 규칙. 배포 URL 설정은 ops에서 확인한다).
- `npm run build` 출력의 라우트 목록에 opengraph-image 경로가 정적(○)으로 나오는지 확인한다.

### 5. e2e: `e2e/landing.spec.ts`
- 새 랜딩에 맞게 고친다: h1 `월급이 어디로 새는지, 파일 하나로 AI가 찾아 드려요`, `로그인 없이 예시 보기` → `/demo`, `무료로 시작`(첫 번째) → `/login?next=`로 시작, 섹션 제목 `새는 돈이 숫자로 보여요`·`AI에는 기능에 필요한 만큼만 보내요`·`이번 달 지출, 파일 하나로 정리해 보세요`가 보인다, 데이터 흐름 표에 `질문과, 답에 필요한 거래 30건 이하(날짜·가맹점·금액)`가 있다. CSP 위반 0건 검사는 유지한다.
- 390px 폭에서 가로 스크롤이 없는지(`document.documentElement.scrollWidth <= innerWidth`) 검사를 하나 추가한다.
- `npm run e2e -- e2e/landing.spec.ts`를 실행해 본다. 샌드박스에서 브라우저 다운로드·포트 바인딩 때문에 실행 자체가 안 되면 blocked로 두지 말고, summary에 "e2e는 하네스 밖에서 확인 필요"라고 적고 completed로 둔다(나머지 AC는 반드시 통과해야 한다).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
npm run e2e -- e2e/landing.spec.ts   # 샌드박스에서 실행 불가면 위 5번 규칙을 따른다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `page.tsx`에 조립 외의 로직이 없는가?
   - 섹션 순서와 `data-landing-section` 값이 UX_GUIDE §4 표와 같은가(hero, tiles, report, steps, trust, pricing, faq, final)?
   - 이벤트 props가 `cta`·`section`뿐인가?
   - `trust-points`를 import하는 곳이 남지 않았는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (e2e 실행 여부를 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `page.tsx`에서 숫자를 계산하거나 조건 분기를 두지 마라. 이유: AGENTS.md 규칙(async RSC는 테스트할 수 없다). 계산은 `getLandingShowcase()`가 한다.
- OG 이미지에 외부 폰트·이미지 URL을 쓰지 마라(`fetch` 금지). 이유: 빌드가 네트워크 없이 돌아야 한다.
- 루트 `layout.tsx`의 메타데이터와 `/demo`·`/pricing` 페이지를 바꾸지 마라. 이유: 이 phase는 랜딩(`/`)만 다룬다.
- `e2e/public-pages.spec.ts` 등 다른 e2e를 바꾸지 마라. 이유: 이 phase의 범위 밖이다.
- 기존 테스트를 깨뜨리지 마라. 지운 `trust-points` 테스트는 예외다.
