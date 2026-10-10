# access: A01 접근 제어 실패 · A07 인증 실패

## A01:2025 Broken Access Control (접근 제어 실패)
사용자가 허용된 범위 밖의 데이터나 기능에 닿는 문제. 2025년판에서 SSRF(CWE-918)가 여기로 합쳐졌다.
주요 CWE: 200·201 민감 정보 노출 · 284·285·862 권한 검사 누락 · 639 사용자가 고른 키로 권한 우회(IDOR) · 352 CSRF · 425 강제 탐색 · 601 오픈 리다이렉트 · 22 경로 조작 · 918 SSRF

### FinSight에서 볼 곳
| 통제 | 위치 |
|---|---|
| 쓰기 커널(인증·Origin·zod) | `src/server/handler.ts` |
| 세션 사용자 | `src/server/auth.ts` (`requireUser` = `getUser()`) |
| 읽기 | `src/server/queries/*` (첫 줄 `requireUser()`) |
| RLS·권한 | `supabase/migrations/*.sql` |
| RLS 우회(admin) | `src/server/admin.ts`, `src/services/supabase/admin.ts` |
| 페이지 보호(편의) | `src/proxy.ts`, `src/lib/domain/routes.ts` |
| 리다이렉트 | `src/lib/domain/redirect.ts` (`safeRedirect`) |

### 체크리스트
- **A01-1 라우트 인증**: `src/app/api/**/route.ts`와 `src/app/auth/**/route.ts`의 export(GET·POST·PUT·PATCH·DELETE)가 모두 `handler({ auth: "user" })`를 거친다. 예외는 `webhooks/polar`(서명), `cron/cleanup`(`auth: "cron"`), public GET `auth/login`·`auth/callback`뿐이다. `"use server"`(Server Action)는 없어야 한다(ADR-001). 인증 없이 데이터를 읽거나 쓰는 경로 → 🔴.
- **A01-2 소유권(IDOR)**: `[id]`를 받는 라우트(`uploads/[id]/*`, `transactions/[id]`)를 action까지 따라간다. 사용자 client(RLS)로 조회하거나 `.eq("user_id", user.id)`를 건다. admin client를 쓰면 먼저 세션 userId로 소유권을 확인한다. admin 함수에 body·params·DB의 사용자 수정 가능 컬럼에서 온 userId·경로를 넘기면 → 🔴.
- **A01-3 RLS**: 모든 `create table`에 `enable row level security`, 정책은 `(select auth.uid()) = user_id`, `using (true)` 없음, `anon` 권한 회수. `entitlements`에는 사용자 쓰기 정책이 없고, `ai_usage`에는 UPDATE·DELETE 정책이 없다. `storage.objects`에 사용자 정책이 없다. `security definer` 함수는 `set search_path = ''`이고 안에서 `auth.uid()`를 확인한다. 뷰는 `security_invoker`. advisors 결과의 RLS·정책·함수·뷰 항목도 여기서 판단한다(dev DB라서 마이그레이션과 다르면 "dev DB 불일치" 🟡, 악용 가능하면 그에 맞게).
- **A01-4 사용자가 쓸 수 있는 컬럼**: 사용자는 공개 anon key와 자기 세션 JWT로 PostgREST에 직접 쓸 수 있다. 본인 전체 권한 테이블(`uploads`·`transactions`·`cards`·`header_mappings`·`category_overrides`·`insights`)의 컬럼(예: `uploads.status`·`mapping`·`storage_path`·`sha256`)을 서버가 권한·경로·과금·상태 판단에 그대로 믿는지 본다. AR-08(`created_at`·`original_deleted_at`)은 수용됨.
- **A01-5 리다이렉트(CWE-601)**: `redirect(`·`NextResponse.redirect`·`Response.redirect`·`Location`을 Grep한다. 사용자 입력(`next`, `returnTo`, 결제 success URL)이 들어가면 `safeRedirect()`를 거친다. `safeRedirect` 자체가 `//evil`, `/\evil`, `javascript:`, 인코딩된 슬래시를 막는지 읽는다.
- **A01-6 CSRF(CWE-352)**: `handler`가 변경 메서드에 Origin(APP_URL과 같음) 또는 `Sec-Fetch-Site`를 검사한다. 이 검사를 건너뛰는 변경 라우트가 없다. GET에 부작용이 없다(예외: `auth/login`의 PKCE 쿠키, `auth/callback`의 세션 교환). 세션 쿠키 `sameSite: "lax"`.
- **A01-7 SSRF(CWE-918)**: 서버의 `fetch(`·`new URL(`·SDK 호출에 사용자가 고른 URL·호스트가 들어가는지 본다(`src/server`, `src/services`, `src/app/api`). `next.config.ts`의 `images.remotePatterns` 와일드카드도 이미지 최적화기를 통한 SSRF 통로다.
- **A01-8 경로 조작(CWE-22)**: Storage 경로는 `{세션 uid}/{서버가 만든 uploadId}/original`. 사용자 파일명은 경로에 쓰지 않는다. `removePrefix`의 prefix는 uid로 시작하고 `/`로 끝난다. id는 uuid 형식 확인 뒤에 쓴다.
- **A01-9 강제 탐색(CWE-425)**: 로그인 뒤 페이지가 모두 `PROTECTED_PREFIXES`에 있는지 `src/app` 페이지 목록과 비교한다. 진짜 방어선은 queries의 `requireUser()`이므로, queries를 거치지 않고 페이지에서 직접 데이터를 읽는 곳 → 🟠. proxy에서만 빠지고 queries가 막으면 🟡.
- **A01-10 응답 노출(CWE-200·201)**: API 응답과 Client Component props가 필요한 필드만 담는지 본다(`select("*")` 결과를 통째로 넘기면 `storage_path`·`sha256`·원본 `mapping`까지 간다). 다른 사용자 데이터면 🔴, 본인 데이터의 내부 필드면 🟡. AR-07(매핑 샘플의 날짜형 숫자)만 수용됨. 가맹점명 저장·분류 경로의 마스킹은 따로 판단한다.
- 남용 상한·Pro·동의는 design(A06), 웹훅 무결성은 injection(A08)이 본다.

## A07:2025 Authentication Failures (인증 실패)
잘못된 사용자를 정상 사용자로 인정하는 문제. 세션 관리 결함을 포함한다.
주요 CWE: 287 부적절한 인증 · 384 세션 고정 · 613 세션 만료 미흡 · 798·259 하드코딩 자격증명 · 307 시도 횟수 제한 없음 · 1392 기본 자격증명

### 체크리스트
- **A07-1 로그인 흐름**: `src/app/auth/login/route.ts`는 provider 허용 목록(kakao·google)을 쓰고 PKCE로 시작한다(`src/server/actions/auth.ts`의 `startOAuth`). `next`는 `safeRedirect`. `auth/callback`은 `exchangeCodeForSession` 실패 시 `/login?error=`로 보낸다.
- **A07-2 세션 쿠키**: 쿠키를 세우는 두 곳 `src/proxy.ts`와 `src/services/supabase/server.ts`의 `setAll`이 모두 `httpOnly: true`, `sameSite: "lax"`, 프로덕션 `secure`를 덮어쓴다. 한 곳이라도 빠지면 🟠. 세션 외 쿠키(플랜·동의 등)를 권한 판단에 쓰면 🔴.
- **A07-3 사용자 확인 방법**: 서버의 권한 판단은 `getUser()`(Auth 서버 검증)로 한다. `getSession()`은 쿠키를 검증 없이 읽으므로 서버 판단에 쓰면 🔴. `getClaims()`는 proxy에서 세션 갱신·리다이렉트에만 쓴다.
- **A07-4 로그아웃·탈퇴**: `auth/signout`은 POST + `handler`(Origin 검사)이고 `supabase.auth.signOut()`으로 서버 측 refresh token을 무효화한다. 탈퇴는 `adminAuth.deleteUser`와 쿠키 정리를 한다.
- **A07-5 cron 인증**: `cron/cleanup`은 `auth: "cron"`이고 `CRON_SECRET`을 타이밍 안전 비교한다(`handler.ts`의 `sameSecret`). 빈 Bearer·빈 secret이 통과하지 않는다(env 스키마 `min(1)`).
- **A07-6 하드코딩 자격증명**: 소스에 키·토큰·비밀번호 리터럴이 없다(`sk-ant-`, `sb_secret_`, `service_role`, `eyJhbGciOi`, `polar_oat_`, `whsec_`, `password: "…"`). 명백한 테스트 더미는 제외한다. git 이력 속 비밀키는 config(A04-1)가 본다.
- **A07-7 외부 인증 설정**: MFA·로그인 시도 제한은 AR-04로 수용됨. advisors에 auth 관련 항목이 있으면 이메일 로그인이 켜져 있는지와 함께 판단한다.

## 심각도 힌트
- 🔴 다른 사용자 데이터를 읽거나 바꿈, 인증 우회, admin 함수에 믿을 수 없는 id, `getSession()`으로 권한 판단
- 🟠 본인 데이터지만 상태·과금 판단을 우회, 세션 쿠키 속성 누락, CSRF 검사가 빠진 변경 라우트
- 🟡 다른 층이 막고 있는 다층 방어 누락, 내부 필드 노출
