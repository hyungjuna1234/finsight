# Step 2: supabase-server

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (레이어 규칙, `server/admin.ts`, 외부 SDK 메모의 Supabase SSR·Next 16 항목)
- `/docs/ADR.md` (ADR-002)
- `/src/server/env.ts`, `/src/lib/domain/errors.ts`, `/src/lib/domain/redirect.ts` (Step 0)
- `/src/types/database.ts` (Step 1)
- `node_modules/@supabase/ssr/README.md` 및 타입 정의, `node_modules/next/dist/docs/`의 proxy 관련 문서

## 작업

TDD로 진행한다(구현 파일마다 같은 폴더에 테스트 먼저).

### 1. `src/services/supabase/server.ts`
```ts
import "server-only";
export async function createServerSupabase(): Promise<SupabaseClient<Database>>
```
- `@supabase/ssr`의 `createServerClient` + `next/headers`의 `cookies()`.
- `setAll`에서 모든 쿠키 옵션을 **`httpOnly: true`, `sameSite: 'lax'`, `secure: 프로덕션이면 true`로 덮어쓴다.** (Server Component에서 set이 막히는 경우는 무시 — Supabase 가이드 방식)
- URL·anon key는 `getPublicEnv()`에서 읽는다.
- 테스트: `@supabase/ssr`과 `next/headers`를 `vi.mock`해서 setAll에 넘어간 옵션에 httpOnly가 강제되는지 검증.

### 2. `src/services/supabase/admin.ts`
```ts
import "server-only";
export function createAdminSupabase(): SupabaseClient<Database>
```
- `createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })`.
- 이 파일은 `src/server/admin.ts`에서만 import한다(ESLint가 강제). 이번 step에서는 파일만 만들고, `server/admin.ts`는 필요한 step에서 만든다.

### 3. `src/lib/domain/routes.ts` (순수 함수)
- `PROTECTED_PREFIXES` = `/dashboard`, `/transactions`, `/upload`, `/trends`, `/recurring`, `/insights`, `/chat`, `/settings`, `/billing`, `/onboarding`
- `isProtectedPath(pathname: string): boolean` — 접두사 경계를 지킨다(`/dashboards`는 false, `/dashboard/x`는 true).
- `loginRedirectPath(pathname: string, search: string): string` → `/login?next=<encodeURIComponent(pathname+search)>`
- 표로 테스트한다.

### 4. `src/proxy.ts` (Next 16 proxy, 테스트 불필요 — 판단 로직은 routes.ts에)
- Supabase 가이드대로 요청·응답 쿠키에 묶인 server client를 만들고 `supabase.auth.getClaims()`로 세션을 갱신한다(쿠키 옵션 httpOnly 강제는 1과 같게).
- 로그인하지 않았고 `isProtectedPath`면 `loginRedirectPath`로 리다이렉트.
- `/api`, `/auth`, `/_next`, 정적 파일(이미지·폰트·favicon)은 `config.matcher`에서 제외.
- env가 비어 있으면(로컬에서 키 없이 실행) 세션 처리를 건너뛰고 그대로 통과시킨다. 빌드는 env 없이 성공해야 한다.

### 5. `src/server/auth.ts`
```ts
import "server-only";
export interface SessionUser { id: string; email: string | null }
export async function requireUser(): Promise<SessionUser>   // getUser()로 확인, 없으면 AppError('UNAUTHENTICATED')
export async function getOptionalUser(): Promise<SessionUser | null>
```
- 반드시 `supabase.auth.getUser()`를 쓴다(`getSession()` 금지).
- 테스트: `@/services/supabase/server`를 `vi.mock`해서 사용자 있음/없음/에러를 검증.

## Acceptance Criteria

```bash
npm run lint
npm run build   # env 없이 빌드 성공 (proxy 포함)
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 브라우저용 Supabase client(`createBrowserClient`)가 어디에도 없는가?
   - `@supabase/*` import가 `src/services/supabase/**`에만 있는가? (ESLint 통과로 확인)
   - 모든 세션 쿠키가 httpOnly로 설정되는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `middleware.ts`를 만들지 마라. 이유: Next 16은 `proxy.ts`를 쓴다.
- `createBrowserClient`나 `NEXT_PUBLIC_` 외의 키를 클라이언트로 보내는 코드를 만들지 마라. 이유: 브라우저 client 없음 원칙(ADR-002), 비밀키 유출.
- 서버 코드의 사용자 확인에 `getSession()`을 쓰지 마라. 이유: 쿠키만 믿는 값이라 위조·폐기된 세션을 걸러내지 못한다.
- proxy에서 DB를 조회하거나 동의·Pro 여부를 판단하지 마라. 이유: proxy는 세션 갱신과 로그인 리다이렉트만 한다(동의는 Step 5, Pro는 3-pro).
- 기존 테스트를 깨뜨리지 마라.
