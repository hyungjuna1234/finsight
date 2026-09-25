# Step 3: api-handler

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (API 표, 에러 코드 표, `handler()` 설명)
- `/docs/ADR.md` (ADR-001)
- `/src/lib/domain/errors.ts`, `/src/server/env.ts` (Step 0)
- `/src/server/auth.ts` (Step 2)

## 작업

모든 쓰기 API가 거치는 공통 커널과 안전한 로거, 클라이언트용 fetch 래퍼를 만든다. TDD로 진행한다.

### 1. `src/server/logger.ts` — SafeLogger
```ts
import "server-only";
type SafeValue = string | number | boolean | null;
export const logger: {
  info(event: string, fields?: Record<string, SafeValue>): void;
  warn(event: string, fields?: Record<string, SafeValue>): void;
  error(event: string, error: unknown, fields?: Record<string, SafeValue>): void;
};
```
- 한 줄 JSON으로 `console.log`/`console.error`에 쓴다: `{ level, event, ...fields, error: { name, code } }`.
- `error`에서 남기는 것은 **에러 이름과 코드뿐**이다. `message`, `details`, `hint`, `stack`은 남기지 않는다(Postgres 에러의 details에는 "Failing row contains (가맹점, 금액…)"처럼 거래 데이터가 들어간다).
- 문자열 필드는 200자에서 자른다.
- 테스트: details에 `스타벅스`, `5000`이 들어간 Postgres 형태 에러를 넘겨도 출력에 나타나지 않는지 `console` spy로 검증.

### 2. `src/server/handler.ts` — Route Handler 커널
```ts
import "server-only";
type AuthMode = "user" | "public" | "cron";
interface HandlerOptions<B> { auth: AuthMode; body?: ZodType<B> }
interface HandlerContext<B, P> { req: Request; user: SessionUser | null; body: B; params: P }
export function handler<B = undefined, P = Record<string, string>>(
  opts: HandlerOptions<B>,
  fn: (ctx: HandlerContext<B, P>) => Promise<unknown>,
): (req: Request, route: { params: Promise<P> }) => Promise<Response>
```
처리 순서:
1. **Origin 검사** — 메서드가 POST/PUT/PATCH/DELETE이고 `auth !== "cron"`이면: `Origin` 헤더가 있고 `getPublicEnv().appUrl`의 origin과 다르면 403 `FORBIDDEN`. `Origin`이 없는데 `Sec-Fetch-Site: cross-site`이면 403.
2. **인증** — `user` → `requireUser()`. `cron` → `Authorization: Bearer <cronSecret>`을 timing-safe 비교, 틀리면 401 `UNAUTHENTICATED`. `public` → 없음.
3. **body** — `opts.body`가 있으면 `Content-Type`이 `application/json`인지 확인하고 파싱 후 `safeParse`. 실패하면 400 `VALIDATION_FAILED`.
4. `fn` 실행. 반환값이 `Response`면 그대로, `undefined`/`null`이면 204, 그 외 객체는 `Response.json(value)`(200).
5. **에러 변환** — `AppError` → `{ error: { code, message } }` + `ERROR_STATUS[code]`. 그 외 모든 에러 → `logger.error("handler.unexpected", e, { path })` 후 500 `INTERNAL`. 응답에 원본 에러 문구를 넣지 않는다.
- Next 16 Route Handler의 두 번째 인자(`{ params }`, Promise)를 받아 `ctx.params`로 넘긴다. `node_modules/next/dist/docs/`에서 Route Handler 시그니처를 확인하라.
- 테스트: Origin 불일치 403, cron 비밀 불일치 401, 비인증 401, zod 실패 400, AppError 변환, 예상 못 한 에러 500 + 원문 비노출, 204 처리.
- 동의 확인(`consent` 옵션)은 Step 5에서 추가한다. 지금은 넣지 않는다.

### 3. `src/components/ui/api-fetch.ts` — 클라이언트 fetch 래퍼
```ts
export class ApiError extends Error { code: ErrorCode | "NETWORK"; status: number }
export async function apiFetch<T>(path: `/api/${string}` | `/auth/${string}`, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T>
export function redirectPathForError(code: ApiError["code"], currentPath: string): string | null
```
- JSON body는 `Content-Type: application/json`으로 보낸다. 204면 `undefined`.
- 실패 응답의 `{error:{code,message}}`를 `ApiError`로 던진다. 네트워크 오류는 `code: "NETWORK"`.
- `redirectPathForError`: `UNAUTHENTICATED` → `/login?next=…`, `CONSENT_REQUIRED` → `/onboarding/consent`, `PRO_REQUIRED` → `/pricing`, 그 외 null.
- 우리 `/api/*`·`/auth/*` 경로만 받는다(외부 URL 금지).
- 테스트는 `fetch`를 `vi.fn()`으로 대체해 node 환경(`api-fetch.test.ts`)에서 검증한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 응답·로그 어디에도 DB/SDK 에러 원문이나 요청 body가 나가지 않는가?
   - 변경 메서드에서 Origin 검사가 항상 먼저 도는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 로그에 `error.message`, `details`, 요청 body, 쿠키, 헤더 값을 남기지 마라. 이유: 거래 데이터·토큰이 로그로 샌다(CLAUDE.md CRITICAL).
- cron 비밀을 `===`로 비교하지 마라. 이유: 타이밍 공격. `crypto.timingSafeEqual`을 쓴다.
- 커널에 비즈니스 로직(업로드·결제 등)을 넣지 마라. 이유: 커널은 공통 관문만 담당한다.
- Server Action을 만들지 마라. 이유: 쓰기는 Route Handler만(ADR-001).
- 기존 테스트를 깨뜨리지 마라.
