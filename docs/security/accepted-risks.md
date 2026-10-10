# 수용한 보안 위험

`/owasp-scan`은 이 목록의 위험을 지적하지 않고 "수용됨 AR-nn"으로 한 줄만 표시한다. 재검토 조건이 생기거나 같은 문제가 다른 곳에 새로 생기면 다시 지적한다.
추가·삭제는 사람이 한다. 스캔은 이 파일을 고치지 않는다.

## AR-01 CSP `script-src 'unsafe-inline'` (A02, A05)
- 위치: `next.config.ts` (Content-Security-Policy)
- 위험: XSS가 생기면 CSP가 인라인 스크립트 실행을 막지 못한다.
- 수용 이유: Next.js가 인라인 부트스트랩 스크립트를 넣는데, nonce를 쓰면 모든 페이지가 동적 렌더링이 된다(Next.js "Without Nonces" 안내). 대신 `dangerouslySetInnerHTML`을 쓰지 않고, AI 텍스트는 `src/components/ui/safe-markdown.tsx`(`img`·`a` 금지, `skipHtml`)로만 렌더링하고, CSP `connect-src`·`frame-ancestors`·`object-src`·`base-uri`를 좁게 둔다.
- 재검토: `dangerouslySetInnerHTML`이나 사용자 HTML 렌더링이 생길 때, `script-src`에 외부 도메인을 더할 때
- 수용: 2026-10-07

## AR-02 보안 알림 시스템 없음 (A09)
- 위치: `src/server/logger.ts` (SafeLogger → Vercel 로그)
- 위험: 반복 인증 실패, Origin 거부, 웹훅 서명 실패 같은 공격 징후를 실시간으로 알 수 없다.
- 수용 이유: MVP라 사용자가 적다. Vercel 로그로 사후 확인하고, 비용 사고는 Anthropic 콘솔 월 지출 한도로 막는다.
- 재검토: 공개 출시 전
- 수용: 2026-10-07

## AR-03 일일 상한을 동시 요청으로 조금 넘을 수 있음 (A06)
- 위치: `src/server/limits.ts`
- 위험: "오늘 행 수 세기 → Claude 호출" 순서라서 동시 요청이 몰리면 상한을 몇 건 넘는다.
- 수용 이유: ADR-009. Anthropic 콘솔 월 지출 한도가 최종 방어선이다.
- 범위: 동시성으로 생기는 초과만. 상한 검사가 빠진 경로나 `ai_usage` 기록이 빠지는 경로는 수용 대상이 아니다.
- 재검토: 상한 초과로 비용 사고가 날 때, 요금제가 횟수 기반으로 바뀔 때
- 수용: 2026-10-07

## AR-04 MFA·로그인 시도 제한을 OAuth 제공자에 맡김 (A07)
- 위치: `src/app/auth/login/route.ts` (provider 허용 목록: kakao·google)
- 위험: 앱에 MFA·비밀번호 정책·로그인 시도 제한이 없다.
- 수용 이유: 카카오·구글 로그인만 쓰므로 자격증명 검증은 제공자가 한다.
- 재검토: 이메일·비밀번호 로그인을 켤 때 (Supabase dev 프로젝트에서 Email provider가 켜져 있으면 끄기를 권한다)
- 수용: 2026-10-07

## AR-05 Polar SDK alpha 버전 사용 (A03)
- 위치: `package.json` `@polar-sh/sdk` `1.0.0-alpha.22`, `src/services/billing/polar.ts`
- 위험: alpha SDK는 변경·결함 가능성이 크다.
- 수용 이유: ADR-008. 버전을 정확히 고정하고(`^` 없음) `services/billing`에 격리했다.
- 조건: 버전이 정확히 고정되어 있을 때만 수용한다.
- 재검토: 정식 버전 출시, 해당 버전 보안 권고
- 수용: 2026-10-07

## AR-06 SheetJS를 CDN tarball로 설치 (A03)
- 위치: `package.json` `xlsx` → `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- 위험: npm 레지스트리 밖에서 받는 패키지다.
- 수용 이유: SheetJS는 npm 배포를 중단했고 공식 CDN이 최신 버전의 배포처다.
- 조건: `package-lock.json`의 해당 항목에 `integrity`가 있을 때만 수용한다.
- 재검토: 버전을 올릴 때, SheetJS 보안 권고
- 수용: 2026-10-07

## AR-07 날짜로 읽히는 8자리 숫자는 마스킹하지 않음 (A01, CWE-201)
- 위치: `src/lib/ingest/mask.ts`
- 위험: 매핑용 샘플 5행에서 19xx·20xx 날짜로 읽히는 8자리 숫자(예: 승인번호 `20240115`)가 그대로 Claude로 간다.
- 수용 이유: 날짜 열을 매핑하려면 날짜가 보여야 한다. 승인번호는 민감도가 낮다.
- 범위: 매핑 샘플(`maskSamples`) 경로만. 같은 마스킹을 쓰는 가맹점명 저장·분류 경로(`src/lib/ingest/parse.ts`)의 날짜형 숫자는 수용 대상이 아니다.
- 재검토: 계좌번호·카드번호처럼 민감한 값이 이 형태로 새는 사례가 나올 때
- 수용: 2026-10-07

## AR-08 사용자가 `uploads.created_at`·`original_deleted_at`을 바꿀 수 있음 (A06, A01)
- 위치: `supabase/migrations/20260926000000_init.sql` (`uploads_update` 정책, 본인 행 전체 컬럼)
- 위험: 사용자가 자기 JWT로 이 컬럼을 바꿔 하루 30개 업로드 상한, 24시간 미완료 정리, 90일 원본 삭제를 피할 수 있다.
- 수용 이유: 피해가 본인 데이터에 그친다. Claude 비용 상한은 사용자가 고칠 수 없는 `ai_usage`로 센다.
- 재검토: 업로드 수가 비용에 직접 연결될 때, 컬럼 단위 권한을 정리할 때
- 수용: 2026-10-07
- **재검토 필요(2026-10-08 스캔)**: 사용자가 오래된 행을 직접 insert하면 오래된 순으로 처리하는 정리 cron이 그 행에 쓰여 다른 사용자의 원본 삭제가 밀린다. 수용 이유를 벗어나므로 uploads 권한을 좁히는 후속 수정에서 해제한다.
