# config: A02 보안 설정 오류 · A03 공급망 실패 · A04 암호화 실패

## A02:2025 Security Misconfiguration (보안 설정 오류)
보안 강화가 빠졌거나 권한·기본값이 잘못된 설정. 2021년 5위에서 2위로 올랐다.
주요 CWE: 16 설정 · 15 외부에서 설정 제어 · 260 설정 파일 속 비밀번호 · 315 쿠키에 평문 민감 정보 · 489 디버그 코드 · 526 환경변수로 민감 정보 노출 · 611 XXE

### 체크리스트
- **A02-1 보안 헤더**: `next.config.ts`의 CSP(`default-src 'self'`, 프로덕션 `script-src`에 `'unsafe-eval'` 없음, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src`는 self와 `*.supabase.co`만), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`. 외부 도메인·와일드카드를 더해 넓혔으면 🟠. `'unsafe-inline'`은 AR-01로 수용됨.
- **A02-2 비밀 env 경계(CWE-526)**: `process.env.`를 Grep한다. 비밀 env는 `src/server/env.ts`(`server-only`)에서만 읽는다. 그 밖에는 `NODE_ENV`만 허용한다. `NEXT_PUBLIC_`은 APP_URL·SUPABASE_URL·SUPABASE_ANON_KEY 세 개뿐이다. `"use client"` 파일이 `@/server/*`·`@/services/*`를 import하면 🔴. `.gitignore`가 `.env*`를 막고 `.env.example`만 남긴다(`.env` 파일 내용은 읽지 않는다).
- **A02-3 디버그·오류 노출(CWE-489·209)**: `src`에서 `console.`은 `src/server/logger.ts`와 테스트에만 있다. 응답 본문에 스택·DB·SDK 오류 문구가 없다(`handler`는 `ERROR_MESSAGES[code]`만 낸다. `handler` 밖에서 Response를 직접 만드는 `webhooks/polar`·`auth/*`를 확인). `error.tsx`·`global-error.tsx`가 `error.message`를 그대로 보여 주지 않는다. `productionBrowserSourceMaps`가 꺼져 있다. 디버그·테스트용 라우트, `NODE_ENV`에 따라 인증을 건너뛰는 분기가 없다.
- **A02-4 Supabase·Storage 설정**: 버킷 `statements`는 비공개, 10MB 제한, 사용자 정책 없음. 업로드 URL은 upsert 금지. advisors 결과 중 RLS·정책·함수·뷰가 아닌 항목(auth 설정, 확장 위치, storage 등)을 여기서 판단한다.
- **A02-5 배포 설정**: `vercel.json`(cron 경로가 `CRON_SECRET`로 보호됨, 함수 설정), `next.config.ts`의 `images.remotePatterns`·`experimental`·`serverActions.allowedOrigins`.
- **A02-6 기본 계정·불필요 기능**: 마이그레이션·seed에 테스트 계정이나 실데이터가 없다(`insert into auth.users`). 데모(`src/lib/demo`, 데모 페이지)는 합성 데이터만 쓰고 인증을 우회하지 않는다.

## A03:2025 Software Supply Chain Failures (소프트웨어 공급망 실패)
의존성·빌드 도구·CI·배포 경로의 취약점이나 악성 변경. 2021년 "취약하고 오래된 구성요소"를 CI/CD·개발 도구·변경 추적까지 넓혔다.
주요 CWE: 1395·1035 취약한 구성요소 의존 · 1104 관리되지 않는 구성요소 · 1357 충분히 믿을 수 없는 구성요소 · 1329 업데이트할 수 없는 구성요소 · 447 폐기된 함수

### 체크리스트 (deps.txt를 근거로)
- **A03-1 알려진 취약점**: deps.txt의 npm audit. prod 의존성의 high·critical은 취약한 API를 FinSight가 실제로 쓰는지 Grep으로 확인한다. 쓰는 경로가 원격으로 악용되면 🔴(예: Next.js 인증·proxy 우회, RSC 원격 실행), 쓰거나 확인이 안 되면 🟠, 쓰지 않으면 🟡. moderate·low와 dev 전용은 🟡까지. 위치는 `package.json`의 그 의존성 줄(간접 의존성이면 끌어온 직접 의존성 줄)이다.
- **A03-2 버전·출처**: `package-lock.json`이 커밋되어 있고 스크립트·CI가 `npm ci`를 쓴다. 레지스트리 밖 패키지는 lockfile에 `integrity`가 있다(AR-06 조건). alpha·beta·rc·canary는 정확히 고정한다(AR-05 조건). `latest`·`*` 범위가 없다.
- **A03-3 설치 스크립트**: deps.txt의 설치 스크립트 패키지 목록에서 처음 보거나 이유가 불분명한 것 → 🟡.
- **A03-4 CI·훅·하네스**: `.github/workflows/*.yml`이 있으면 서드파티 action을 전체 SHA로 고정(태그만이면 🟡), `permissions`는 최소, `pull_request_target`에서 PR 코드를 체크아웃해 secret과 함께 실행하지 않는다(그러면 🔴), `run:`에 `${{ github.event.* }}`를 직접 넣지 않는다(스크립트 주입). `.githooks/*`, `scripts/hooks/*`, `scripts/execute.py`, `scripts/review_code.py`가 `--dangerously-*` 우회 플래그를 쓰지 않는다(🟠). 없으면 "해당 없음".
- **A03-5 런타임 외부 코드**: 레이아웃·페이지에 서드파티 CDN `<script src>`·`<link>`가 없다(폰트는 로컬 Pretendard). 있으면 무결성(SRI)과 CSP를 함께 본다.

## A04:2025 Cryptographic Failures (암호화 실패)
약한 알고리즘, 부족한 암호화, 유출된 키, 키 관리 실패.
주요 CWE: 327 위험한 알고리즘 · 330·338 약한 난수 · 319 평문 전송 · 321 하드코딩 키 · 326 부족한 강도 · 759·916 약한 비밀번호 해시

### 체크리스트
- **A04-1 비밀키 유출(CWE-321·798)**: deps.txt의 gitleaks 또는 정규식 결과(작업 트리·커밋 이력). 실제 비밀키가 레포나 이력에 있으면 🔴(→ Fix는 키 교체 후 이력 정리). 테스트 더미·공개 anon key는 제외하고 그 판단을 적는다.
- **A04-2 전송 구간(CWE-319)**: 운영 코드의 외부 URL은 https다. `http://`는 localhost·테스트·설정 더미에만 있다. HSTS는 A02-1.
- **A04-3 난수(CWE-330·338)**: `Math.random()`을 id·토큰·파일명·nonce에 쓰지 않는다(`crypto.randomUUID()`·`gen_random_uuid()`). 보안에 쓰이면 🟠.
- **A04-4 해시·비교(CWE-327)**: 파일 식별 sha256은 보안 해시가 아니라 괜찮다. md5·sha1을 보안 목적으로 쓰면 🟠. 비밀 비교는 타이밍 안전 비교(`handler.ts`의 `sameSecret`, 웹훅은 SDK)다. 비밀을 `===`로 비교하면 🟡.
- **A04-5 저장 데이터(CWE-311·312·315)**: PDF 비밀번호는 DB·Storage·로그·응답·URL·클라이언트 저장소에 남지 않는다(ADR-012). 원본은 비공개 버킷에 두고 90일 뒤 지운다. `localStorage`·`sessionStorage`에 거래·파일·비밀번호를 두지 않는다(🟠). 세션 외 쿠키에 민감 정보가 없다.
- **A04-6 캐시**: 사용자별 데이터를 정적으로 캐시하지 않는다. `"use cache"`·`unstable_cache`·`cacheTag`·`export const revalidate`·`dynamic = "force-static"`을 Grep한다. 사용자 데이터를 읽는 함수에 캐시 키로 userId 없이 붙어 있으면 다른 사용자에게 데이터가 나간다 → 🔴. Next 16 캐시 동작은 `node_modules/next/dist/docs/`에서 확인한다.

## 심각도 힌트
- 🔴 실제 비밀키가 레포·이력·번들에 있음, 사용자 데이터가 사용자 사이에 캐시됨, `pull_request_target` 실행, 원격 악용되는 prod 의존성
- 🟠 보안 헤더를 넓힘, 보안용 `Math.random`, 우회 플래그, 쓰는 경로가 있는 prod high
- 🟡 dev 전용 취약점, 태그로만 고정한 action, 모범 사례 차이
