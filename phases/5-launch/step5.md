# Step 5: e2e-smoke

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (`npm run e2e`, 테스트 규칙)
- `/docs/ADR.md` (ADR-010: async 페이지는 e2e로 검증) · `/docs/USER_FLOWS.md` (화면 목록)
- `/package.json` (`"e2e": "playwright test"`, `@playwright/test` 1.63) · `/vitest.config.mts` (vitest는 `src/**`·`supabase/**`만 수집)
- `/src/server/auth.ts`와 테스트 (`getOptionalUser`, `requireUser`)
- `/src/proxy.ts`, `/src/lib/domain/routes.ts` (비로그인 → `/login?next=…`)
- `/src/app/(marketing)/**` (랜딩·demo·pricing·guide·privacy·terms·refund), `/src/components/marketing/*`
- `/next.config.ts` (Step 4 보안 헤더)
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`

## 작업

키 없이 공개 화면과 보안 헤더를 실제 브라우저로 확인한다. Supabase는 없는 주소(더미)로 두고, 로그인이 필요한 여정은 이 step에서 다루지 않는다(Polar sandbox 여정 e2e는 사람이 ops에서 한다).

### 0. 사전 확인
`src/app/(marketing)/pricing/page.tsx`가 없으면(4-billing 미실행) `"status": "blocked"`, `"blocked_reason": "4-billing 미완료 — /pricing 없음"`으로 두고 중단한다.

### 1. `getOptionalUser` 견고성 (TDD, `src/server/auth.test.ts`)
- Supabase에 연결할 수 없을 때(`getUser()`가 네트워크 에러를 던지거나 `{ error }`로 돌려줄 때) `getOptionalUser`는 **예외 없이 `null`**을 돌려줘야 한다. `requireUser`는 이 경우 `AppError('UNAUTHENTICATED')`.
- 테스트를 먼저 추가하고, 지금 코드가 그렇게 동작하지 않으면 고친다. 에러 원문은 로그에 남기지 않는다(`logger.warn`에 code만).
- `src/proxy.ts`도 세션 갱신이 실패하면(예외) 로그인 안 한 것으로 보고 계속 진행하는지 확인한다. 아니면 `try/catch`로 감싼다.

### 2. `playwright.config.ts` (루트)
```ts
export default defineConfig({
  testDir: "e2e", testMatch: "**/*.spec.ts", fullyParallel: true, retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 240_000,
    env: { NEXT_PUBLIC_APP_URL: "http://localhost:3100", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
           NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-dummy-anon-key" },
  },
});
```
- **더미 공개 env는 `webServer.env`에만 둔다.** `.env*` 파일을 만들지 않는다. 비밀 env(service role·Anthropic·Polar)는 넣지 않는다. 공개 화면은 비밀 없이 떠야 한다.
- 포트 3100을 쓴다(개발 서버 3000과 겹치지 않게). `test-results/`, `playwright-report/`는 이미 `.gitignore`에 있다.

### 3. 테스트 `e2e/` (`*.spec.ts`, vitest가 수집하지 않는 위치)
- `landing.spec.ts`
  - `/`에 h1 "카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요"가 있다.
  - [예시 보기] href가 `/demo`다.
  - [무료로 시작] href가 `/login?next=`로 시작한다.
  - 보안 3줄 문구가 보인다.
  - 페이지를 여는 동안 `console` 에러 중 "Content Security Policy" 위반이 0건이다.
- `public-pages.spec.ts`
  - `/demo`: 샘플 대시보드가 보인다. 2-dashboard demo 페이지에서 고정 문구(예: 예시 데이터 안내, 요약 타일 라벨)를 골라 확인한다.
  - `/pricing`: "₩6,900"과 "국내전용 카드는 결제되지 않아요"
  - `/guide`: "이용내역" 제목과 카드사 6곳 이름
  - `/privacy`: "초안 — 법률 검토 전", `#overseas` 표 안의 "Anthropic"
  - `/terms`: "조언이 아님"
  - `/refund`: "7일"
  - 위 페이지 모두 상태 200이고 CSP 위반 콘솔 에러가 없어야 한다.
- `auth-redirect.spec.ts`
  - 쿠키 없이 `/dashboard`로 가면 최종 URL이 `/login?next=%2Fdashboard`다.
  - `/settings`도 같은 방식으로 리다이렉트된다.
- `security-headers.spec.ts`: `request.get("/")` 응답 헤더를 확인한다.
  - `content-security-policy`에 `frame-ancestors 'none'`과 `img-src 'self' data:`
  - `x-content-type-options: nosniff`
  - `referrer-policy: strict-origin-when-cross-origin`
  - `permissions-policy`에 `camera=()`
  - `strict-transport-security` 존재
  - `x-powered-by` 없음
- 테스트는 외부 네트워크에 기대지 않는다. Supabase 더미 주소로 나가는 요청이 실패해도 공개 페이지는 떠야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
npx playwright install chromium && npm run e2e
```
- `npx playwright install chromium`이 네트워크·권한 문제로 불가능하면 코드는 그대로 두고 `"status": "blocked"`, `"blocked_reason": "Playwright 브라우저 다운로드 불가: <에러 요약> — 사람이 npx playwright install chromium 후 npm run e2e 실행 필요"`로 둔다. 이때도 앞의 세 커맨드는 반드시 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `.env*` 파일 없이 `webServer.env`의 더미 공개 값만으로 서버가 뜨는가?
   - e2e 파일이 `e2e/`에만 있고 vitest가 수집하지 않는가(`npm run test` 결과에 e2e가 없음)?
   - `getOptionalUser`가 Supabase 장애 시 null을 돌려주는 단위 테스트가 있는가?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (spec 파일과 확인한 경로를 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(브라우저 다운로드 불가 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `.env`, `.env.local`, `.env.test` 파일을 만들거나 읽지 마라. 이유: 보안 hook이 차단하고, 더미 값은 설정 파일에만 둔다.
- 실제 Supabase·Polar·Anthropic 키나 주소를 e2e에 넣지 마라. 이유: 이 복사본에는 운영 자격증명이 없다(ops/README.md).
- 로그인 우회용 테스트 전용 라우트나 환경 분기(`if (process.env.E2E)`)를 앱 코드에 넣지 마라. 이유: 운영에 인증 우회 경로가 남는다.
- `e2e/` 테스트를 `*.test.ts`로 이름 짓지 마라. 이유: 이름이 겹치면 vitest·Playwright가 서로의 파일을 수집해 실패한다.
- 실패하는 e2e를 `test.skip`으로 덮지 마라. 이유: 배포 전 마지막 확인이다. 막히면 원인을 고치거나 blocked로 보고한다.
- 기존 테스트를 깨뜨리지 마라.
