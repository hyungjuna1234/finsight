# 프로젝트: FinSight

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

한국 개인 사용자가 **카드 이용내역 파일(CSV/xls/xlsx)이나 PDF 명세서**를 올리면 Claude가 분류·요약해 대시보드로 보여주는 SaaS의 MVP.
전체 계획은 루트의 `plan.md`, 세부 설계는 `docs/`에 있다.

## 기술 스택
- Next.js 16.3 App Router (`src/`), React 19, TypeScript strict + `noUncheckedIndexedAccess`
- Tailwind CSS v4 (토큰은 `src/app/globals.css`, 규칙은 `docs/UI_GUIDE.md`, 화면 흐름·문구는 `docs/UX_GUIDE.md`), Pretendard 로컬 폰트
- Supabase: Auth(카카오·구글) · Postgres(RLS) · Storage, 서울 리전. `@supabase/ssr` httpOnly 쿠키
- Claude: `@anthropic-ai/sdk` — 매핑·분류 `claude-haiku-4-5`, 인사이트·채팅 `claude-sonnet-5`
- 결제: Polar (`@polar-sh/sdk` alpha, `services/billing`에 격리)
- 파싱: SheetJS 0.20.3(CDN tarball) + `iconv-lite`(CP949) + `unpdf`(PDF 명세서, pdf.js) · 차트: Recharts 3 · 검증: zod 4
- 테스트: Vitest 5 (`*.test.ts` → node, `*.test.tsx` → jsdom), PGlite(RLS), Playwright(e2e)

**Next.js 16은 학습 데이터와 다르다.** `middleware.ts` 대신 `proxy.ts`, `next lint` 없음 등. Next API를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서를 읽어라.

## 아키텍처 규칙
- CRITICAL: **레이어 규칙.** `src/lib/**`는 순수 함수만(next·react·supabase·server·services import 금지). `src/components/**`는 표시 데이터를 props로만 받는다(쓰기·폴링·AI 호출은 `apiFetch`로 우리 `/api/*`만). 브라우저용 Supabase client는 만들지 않는다. admin client는 `src/server/admin.ts`에서만 쓴다. ESLint가 강제한다.
- CRITICAL: **비밀키는 서버 전용.** 비밀 env는 `import "server-only"` 모듈(`src/server/env.ts`)에서만 읽는다. `NEXT_PUBLIC_`은 APP_URL·SUPABASE_URL·SUPABASE_ANON_KEY만. env가 하나도 없어도 `npm run build`가 통과해야 한다(지연 검증). `.env*` 파일은 읽거나 출력하지 않는다(`.env.example`만 참고).
- CRITICAL: **모든 테이블에 RLS.** 사용자 데이터는 본인 행만. 권한·무료 크레딧(`entitlements`)은 사용자가 쓸 수 없고 admin만 쓴다. `anon` 권한은 회수한다.
- CRITICAL: **쓰기는 Route Handler + `handler()` 커널로만.** 커널이 `requireUser()`(getUser), 변경 메서드 Origin 검사, zod 검증, 에러 변환, SafeLogger를 처리한다. GET에는 부작용이 없다. 읽기는 Server Component → `src/server/queries/*`이고, queries 함수의 첫 줄은 `requireUser()`다. 리다이렉트는 전부 `safeRedirect()`를 거친다.
- CRITICAL: **Pro 기능은 서버의 `requirePro()`로만 허용한다.** Claude 호출 전에는 `requireConsent()`와 일일 상한을 확인하고, 호출 후 `ai_usage`에 기록한다.
- CRITICAL: **Claude에는 최소 데이터만.** 매핑 = 마스킹한 헤더+샘플 5행, 분류 = 가맹점명, 인사이트 = 집계값, 채팅 도구 = 30행 이하. AI 출력은 zod·enum으로 검증하고, 마크다운은 요소 허용 목록으로 렌더링한다(`img`·`a` 금지). 투자·세무 조언은 거절한다.
- CRITICAL: **로그에 거래·가맹점·금액·파일 내용·프롬프트·DB 에러 상세를 남기지 않는다**(SafeLogger는 코드·ID·개수만).
- 금액은 정수 KRW(`KRW` 타입), 표시는 `formatKRW()`만. 월 경계는 KST(Asia/Seoul).
- 외부 API(Claude·Polar)는 `src/services/*` 래퍼로만 호출한다. Storage·Auth admin 작업은 `src/server/admin.ts`의 함수로만 한다. 모델 ID는 `src/services/claude/models.ts`에만 둔다.
- 디렉토리·인터페이스·DB·API 계약은 `docs/ARCHITECTURE.md`를 따른다. 결정 배경은 `docs/ADR.md`.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD). 테스트는 대상과 **같은 폴더**에 `X.test.ts`(node) / `X.test.tsx`(jsdom)로 둔다(`__tests__/` 금지). TDD guard hook이 강제한다.
- 테스트는 네트워크를 쓰지 않는다. 외부 서비스는 `vi.mock("@/services/...")`로 대체한다. 실제 카드 명세서는 레포에 넣지 않고 fixture는 코드로 합성한다.
- `page.tsx`/`layout.tsx`에는 로직을 두지 않는다(async RSC는 Vitest로 테스트할 수 없다). 로직은 `src/lib`·`src/server`에 두고 테스트한다.
- 새 의존성은 추가하지 않는다. 필요하면 step을 `blocked`로 두고 이유를 적는다.
- `supabase`·`vercel`·`psql` CLI는 이 복사본에서 쓰지 않는다(`ops/README.md`).
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, test:, chore:)
- harness(`scripts/execute.py`)는 `codex exec --sandbox workspace-write`로 step을 돌린다. 샌드박스에서 `.git`은 읽기 전용이라 커밋은 하네스가 한다.
- 보안 감사: `/owasp-scan`은 OWASP Top 10:2025 기준으로 코드베이스 전체를 감사한다(그룹 에이전트 `.claude/agents/owasp-scanner.md` + npm audit·gitleaks·Supabase advisors·로컬 서버 probe). 보고서는 `docs/security/owasp-YYYY-MM-DD.md`, 받아들인 위험은 `docs/security/accepted-risks.md`.
- 가드 훅은 `scripts/hooks/*`에 있고 Codex(`.codex/hooks.json`)와 Claude Code(`.claude/settings.json`)가 같이 쓴다. `.codex/hooks.json`을 바꾸면 Codex `/hooks`에서 다시 신뢰해야 돈다.
- 리뷰: `/review`는 규칙 체크리스트, `/review-code`는 차원별 에이전트(`.claude/agents/review-*.md`)를 동시에 돌린다. 심각도·판정·출력 형식은 `docs/REVIEW_GUIDE.md`를 따른다. `git push`하면 `.githooks/pre-push`가 `scripts/review_code.py`로 `/review-code`를 돌려 Blocked면 push를 막는다(몇 분 걸림). 세션에서 이미 `/review-code`로 본 변경은 `SKIP_REVIEW=1 git push`로 건너뛴다. PR은 `.github/workflows/review.yml`이 verify와 리뷰를 돌려 PR에 리뷰를 단다(설정: `ops/README.md`).

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint (레이어 규칙 포함)
npm run test     # Vitest (unit + dom)
npm run e2e      # Playwright (5-launch 이후)
