# Step 4: auth-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOWS.md` (① 첫 방문, 인증 예외)
- `/docs/ARCHITECTURE.md` (API 표의 `/auth/*`, Supabase SSR 메모)
- `/docs/UI_GUIDE.md`
- `/src/services/supabase/server.ts`, `/src/server/auth.ts`, `/src/lib/domain/routes.ts` (Step 2)
- `/src/server/handler.ts`, `/src/lib/domain/redirect.ts` (Step 0, 3)

## 작업

카카오·구글 OAuth를 **서버에서 시작**하는 로그인 흐름을 만든다(브라우저 Supabase client 없음). 실제 OAuth 키는 없으므로 Supabase 호출은 테스트에서 mock한다. TDD로 진행한다.

### 1. `src/lib/domain/user-agent.ts`
- `detectInAppBrowser(ua: string): 'kakaotalk' | 'instagram' | 'facebook' | 'naver' | 'line' | null`
- 표로 테스트(실제 UA 문자열 예시 포함, 일반 Safari/Chrome은 null).

### 2. `src/app/auth/login/route.ts` — `GET ?provider=kakao|google&next=`
- provider가 둘 중 하나가 아니면 `/login?error=provider`로 302.
- `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(safeRedirect(next))}` } })` → 받은 `data.url`로 302. 실패 → `/login?error=oauth`.
- 카카오는 이메일이 없을 수 있으므로 scope를 강제하지 않는다.
- 이 GET은 PKCE code verifier 쿠키만 설정한다(사용자 데이터 변경 없음).
- 로직(검증·redirectTo 조립)은 `src/server/actions/auth.ts`의 `startOAuth(provider, next)`에 두고 테스트한다. route.ts는 호출만 한다(route.test.ts로 302 동작 검증).

### 3. `src/app/auth/callback/route.ts` — `GET ?code=&next=`
- `exchangeCodeForSession(code)` 성공 → `safeRedirect(next, '/dashboard')`로 302. `error` 쿼리(사용자 취소 등)나 교환 실패 → `/login?error=cancelled` 또는 `/login?error=callback`.
- 테스트: 성공, 취소, 실패, `next=//evil.com`이 `/dashboard`로 바뀌는지.

### 4. `src/app/auth/signout/route.ts` — `POST`
- `handler({ auth: "user" }, …)`로 감싸 Origin 검사를 받는다. `supabase.auth.signOut()` 후 `/`로 303.

### 5. 로그인 화면 `src/app/(auth)/login/page.tsx` + `src/components/auth/login-panel.tsx`
- 페이지는 `headers()`의 User-Agent로 `detectInAppBrowser`를 부르고, `searchParams`의 `next`·`error`를 읽어 `LoginPanel`에 props로 넘긴다(로직 없음).
- `LoginPanel`(props: `next`, `error`, `inAppBrowser`): [카카오로 시작하기] [구글로 시작하기] 링크(`/auth/login?provider=…&next=…`).
  - 인앱 브라우저면 구글 버튼 위에 안내: "카카오톡 안에서는 구글 로그인이 막혀 있어요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요."
  - `error`별 한국어 안내(취소·실패).
  - 하단 한 줄: "연동 없이 카드 내역 파일만 받아요. 원본은 90일 후 자동 삭제돼요."
  - `docs/UI_GUIDE.md`를 따른다(좌측 정렬, 포인트 색 1개).
- `login-panel.test.tsx`로 버튼 링크·안내 문구를 검증한다.

### 6. 앱 레이아웃 `src/app/(app)/layout.tsx`
- `getOptionalUser()`가 null이면 `redirect(loginRedirectPath(...))`. (동의 확인은 Step 5에서 추가)
- 상단 바 자리만 두고 `children`을 렌더한다. 페이지 로직은 넣지 않는다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 모든 리다이렉트 대상이 `safeRedirect()`를 거치는가?
   - 브라우저에서 Supabase SDK를 쓰는 코드가 없는가?
   - `page.tsx`에 판단 로직이 없고 컴포넌트는 props만 받는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (실제 OAuth 앱 설정은 사람이 나중에 한다 — 이 step은 키 없이 완료할 수 있다)

## 금지사항

- `next`·`redirectTo`를 검증 없이 쓰지 마라. 이유: 오픈 리다이렉트로 피싱에 악용된다.
- 로그인 버튼에서 클라이언트 SDK로 `signInWithOAuth`를 부르지 마라. 이유: 브라우저 Supabase client 없음 원칙(ADR-002).
- 이메일·비밀번호 로그인이나 매직링크를 만들지 마라. 이유: MVP 범위는 카카오·구글만이다.
- OAuth 실패 원인(Supabase 에러 문구)을 화면에 그대로 보여주지 마라. 이유: 내부 정보 노출. 정해진 한국어 안내만 쓴다.
- 기존 테스트를 깨뜨리지 마라.
