# Step 4: deploy-config

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (구성도의 Vercel icn1·Cron, 업로드 처리의 `maxDuration`, 외부 SDK 메모)
- `/plan.md` 1-2장(AI 마크다운 허용 목록 + 기본 CSP), 2장(Vercel `icn1`), 12장 6번(보안 헤더 점검)
- `/ops/README.md` (배포·env 등록은 사람이 `finsight-ops/`에서 한다)
- `/next.config.ts`, `/src/app/layout.tsx` (Step 0에서 넣은 `<Analytics />`)
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` ("Without Nonces" 절)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`
- `node_modules/@vercel/analytics/dist/next/index.mjs` (`getScriptSrc`: 운영은 `/_vercel/insights/script.js`, 개발은 `https://va.vercel-scripts.com`)
- `src/app/api/**/route.ts` 전체 (Claude·Polar를 부르는 라우트 목록 파악)

## 작업

배포 설정 파일과 보안 헤더를 만든다. **Vercel 프로젝트 연결·env 등록·배포는 사람이 `finsight-ops/`에서 한다.** 이 step에서 `vercel` CLI를 쓰지 않는다(hook이 막는다).

### 1. `vercel.json`
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["icn1"],
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 18 * * *" }] }
```
- `0 18 * * *`은 UTC 18시, 곧 **KST 03:00**이다.
- Hobby 플랜은 cron을 하루 한 번만 허용하고, 실행 시각이 그 시간대 안에서 밀릴 수 있다. 하루 한 번이면 충분하다.
- JSON에는 주석을 쓸 수 없다. 이 설명은 아래 4번의 ops 체크리스트에 적는다.

### 2. `next.config.ts` — 모든 경로(`source: "/(.*)"`)에 보안 헤더
- `poweredByHeader: false`
- `Content-Security-Policy` (`isDev = process.env.NODE_ENV === "development"`는 함수 안에서 읽는다)
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline'{isDev: 'unsafe-eval' https://va.vercel-scripts.com};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  ```
  - `'unsafe-inline'`(script)가 필요한 이유: Next가 nonce 없이 인라인 부트스트랩 스크립트를 넣는다. nonce 방식은 모든 페이지를 동적 렌더링으로 바꿔야 한다. MVP는 Next 문서의 "Without Nonces" 방식을 쓰고, 이 이유를 설정 파일 주석에 남긴다.
  - Vercel Analytics는 운영에서 같은 오리진(`/_vercel/insights/*`)을 쓰므로 추가 오리진이 없다. 개발에서만 `va.vercel-scripts.com`을 허용한다.
  - `connect-src`의 `https://*.supabase.co`는 브라우저가 signed URL로 파일을 PUT하기 위해 필요하다.
  - `form-action 'self'`로 충분하다. checkout·포털은 폼 제출이 아니라 `window.location.assign`으로 이동한다. 0-foundation 로그인 버튼이 `<form>`이 아니라 링크인지 확인한다(폼이면 OAuth 리다이렉트가 막힌다).
  - `upgrade-insecure-requests`는 넣지 않는다. e2e가 `http://localhost`에서 돌고, 운영은 HSTS가 막는다.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (preload는 도메인을 정한 뒤 사람이 판단)
- `next.config.ts`는 `src/`의 모듈을 import하지 않는다. 설정 파일 안에서 문자열을 조립한다.

### 3. `maxDuration` 점검
Claude·Polar·긴 작업을 하는 라우트가 모두 `export const maxDuration = N`을 갖게 한다. 없으면 추가하고, 값이 다르면 맞춘다.
| 라우트 | 값 |
|---|---|
| `api/uploads/[id]/analyze` | 60 |
| `api/uploads/[id]/confirm` | 120 |
| `api/uploads/[id]/recategorize` | 120 |
| `api/chat` | 60 |
| `api/insights` (60초 호출 + 숫자 섞이면 1회 재생성) | 120 |
| `api/billing/{checkout,portal,confirm}`, `api/webhooks/polar` | 30 |
| `api/account/delete`, `api/cron/cleanup` | 60 |

### 4. 사람용 배포 체크리스트 — `ops/README.md`
"사람이 직접 할 준비"에 아래 항목을 추가한다. 이 문서 수정은 허용된다.
- Vercel 프로젝트 연결(대시보드 또는 ops clone)
- Preview는 Polar sandbox, Production은 production env로 분리
- `CRON_SECRET` 등록
- Hobby는 cron이 하루 1회다. 120초 `maxDuration`이 플랜에서 허용되는지 확인한다
- Polar 웹훅 URL `https://<도메인>/api/webhooks/polar`, 이벤트는 `customer.state_changed`·`subscription.*`·`order.paid`
- Supabase Auth Redirect URL에 `https://<도메인>/auth/callback`
- 배포 후 `curl -I`로 보안 헤더 확인

### 5. 테스트
- `src/test/next-config.test.ts`
  - `next.config.ts`의 default export를 import해 `await config.headers()`를 부른다. `source: "/(.*)"` 항목에 위 헤더가 모두 있는지 확인한다.
  - CSP에 `img-src 'self' data:`와 `frame-ancestors 'none'`이 들어 있고 `default-src 'self'`로 시작하는지 확인한다.
  - `vi.stubEnv("NODE_ENV", "production")`일 때 `'unsafe-eval'`과 `va.vercel-scripts.com`이 없는지 확인한다.
- `src/test/route-config.test.ts`: 위 표의 라우트 파일을 `fs`로 읽는다. `export const maxDuration = <값>`이 있는지 정규식으로 확인하고, 파일이 없으면 실패한다.
- `src/test/vercel-config.test.ts`: `vercel.json`을 읽어 `regions`가 `["icn1"]`이고 cron이 `/api/cron/cleanup`, `0 18 * * *`인지 확인한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - CSP가 `'self'` 기준이고, 외부 오리진은 Supabase(connect)와 개발용 Analytics뿐인가?
   - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`가 있는가?
   - 모든 Claude·Polar 라우트에 `maxDuration`이 있는가? env 없이 빌드되는가?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` ("Vercel 연결·env·배포는 사람이 ops에서"를 포함한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `vercel` CLI를 실행하거나 `.vercel/`을 만들지 마라. 이유: 운영 자격증명은 이 복사본에 없고 hook이 차단한다(ops/README.md).
- CSP에 `*`, `https:`, `'unsafe-eval'`(운영)을 넣지 마라. 이유: XSS가 나면 데이터 유출 경로가 된다(plan 1-2장).
- `img-src`에 외부 오리진을 열지 마라. 이유: AI 마크다운 `img` 금지와 함께 이미지 URL로 데이터를 빼내는 경로를 막는다.
- `vercel.json`에 env 값이나 비밀을 넣지 마라. 이유: 레포에 커밋된다.
- 보안 헤더를 `proxy.ts`에서 붙이지 마라. 이유: proxy matcher가 `/api`·정적 파일을 빼므로 모든 경로에 걸리지 않는다. `next.config.ts`의 `headers()`로 한 곳에서 관리한다.
- 기존 테스트를 깨뜨리지 마라.
