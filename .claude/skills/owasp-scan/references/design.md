# design: A06 안전하지 않은 설계 · A09 로깅·알림 실패 · A10 예외 상황 처리 미흡

## A06:2025 Insecure Design (안전하지 않은 설계)
구현이 완벽해도 막을 수 없는, 처음부터 빠진 통제. 업무 흐름·남용·신뢰 경계 설계를 본다.
주요 CWE: 841 업무 흐름 강제 실패 · 362 경쟁 조건 · 434 위험한 파일 업로드 · 501 신뢰 경계 위반 · 807 믿을 수 없는 입력으로 보안 판단 · 269 권한 관리 · 256·522 자격증명 보관

### 체크리스트
- **A06-1 비용 상한**: Claude를 부르는 모든 경로(`src/services/claude/*`를 부르는 곳)가 호출 전에 `assertDailyLimit`, 호출 **직후** `recordAiUsage`를 한다. 뒤 단계(저장·파싱)가 실패해도 기록이 남는가. 업로드 하루 30개, 분류 상한, 채팅 도구 5회, 무료 인사이트는 호출 전 `markFreeInsightUsed`(조건부 update)로 선점하고 실패하면 `releaseFreeInsight`. 상한 없이 Claude를 부르는 경로 → 🟠. 동시 요청 초과는 AR-03으로 수용됨.
- **A06-2 Pro·동의**: Pro 기능(인사이트·채팅·추이·정기결제)은 라우트와 페이지 데이터 읽기 **둘 다** 서버에서 `requirePro()`(또는 `getPlan`)를 확인한다. UI만 숨기면 🔴. Claude 호출 전 `requireConsent()`(`handler`의 `consent: true`)가 없으면 🔴.
- **A06-3 업무 흐름(CWE-841)**: 업로드 상태 `uploaded → awaiting_confirm → done|failed`. confirm은 `awaiting_confirm`에서만, recategorize는 `pending`만. 상태는 서버가 DB에서 읽지만 사용자가 PostgREST로 `status`를 바꿀 수 있다 — 바꿔서 얻는 것(상한 우회, 검증 건너뛰기)이 있는지 따진다.
- **A06-4 파일 업로드(CWE-434)**: 형식은 클라이언트 MIME·확장자가 아니라 서버의 시그니처 검사(sniff)로 정한다. 크기는 클라이언트가 보낸 `size`가 아니라 버킷 제한·실제 바이트로 막는다. 원본은 사용자에게 다시 서빙하거나 실행하지 않는다.
- **A06-5 권한 분리(CWE-269·501)**: admin(service role) 권한은 `src/server/admin.ts`의 좁은 함수로만 쓴다(ARCHITECTURE 목록). 테이블 이름·필터를 받는 범용 admin 함수가 생기면 🟠.
- **A06-6 경쟁 조건(CWE-362)**: 돈·크레딧·권한에 닿는 check-then-act(무료 크레딧, `upsertIfNewer`, 탈퇴 중 업로드). AR-03 밖의 경쟁 조건은 🟡~🟠.
- **A06-7 자격증명 보관(CWE-256·522)**: PDF 비밀번호는 요청 body(POST)로만 오고 메모리에서만 쓴다(ADR-012). DB·Storage·로그·오류 메시지·분석 이벤트·URL 쿼리·클라이언트 저장소에 남으면 🔴.
- **A06-8 보관·삭제**: 원본 90일 삭제, 24시간 지난 미완료 업로드 정리, 탈퇴 시 cascade + Storage prefix 삭제 + Polar 구독 해지. 사용자가 정리 기준 컬럼(`created_at`·`original_deleted_at`)을 고칠 수 없는지(마이그레이션의 컬럼 grant) 확인한다.

## A09:2025 Security Logging and Alerting Failures (로깅·알림 실패)
공격을 기록·탐지·알림하지 못하거나, 로그로 민감 정보가 새는 문제. 2025년판은 "모니터링"을 "알림"으로 바꿨다.
주요 CWE: 532 로그에 민감 정보 · 778 불충분한 로깅 · 117 로그 출력 무력화 실패 · 223·221 보안 정보 누락

### 체크리스트
- **A09-1 로그 속 민감 정보(CWE-532)**: 로그는 `src/server/logger.ts`(SafeLogger)만 쓴다. `logger.info|warn|error(` 호출의 필드를 모두 읽는다. 거래·가맹점·금액·파일명·파일 내용·이메일·프롬프트·PDF 비밀번호·`error.message`·DB 오류 `details`/`hint`가 들어가면 🔴(AGENTS.md CRITICAL). Vercel Analytics `track(` 이벤트 속성도 같다.
- **A09-2 보안 이벤트 기록(CWE-778)**: 웹훅 서명 실패, cron 인증 실패, Origin 거부, 예상 못 한 오류가 코드·ID만으로 남는지 본다. `handler`는 `AppError`(FORBIDDEN 등)를 기록하지 않는다. 빠진 것은 묶어서 🟡 하나로만 적는다.
- **A09-3 로그 주입(CWE-117)**: 로그는 `JSON.stringify`로 쓰고 200자로 자른다. 사용자 문자열을 JSON 밖에서 이어 붙여 로그에 쓰면 지적한다.
- **A09-4 감사 기록**: `ai_usage`는 append-only(UPDATE·DELETE 정책 없음), `entitlements`는 admin만 쓴다, 동의는 버전과 함께 insert만 한다.
- **A09-5 알림**: 알림 시스템 없음은 AR-02로 수용됨(재검토: 공개 출시 전). 출시가 가까워졌다는 근거(문서·체크리스트)가 보이면 재검토 필요로 적는다.

## A10:2025 Mishandling of Exceptional Conditions (예외 상황 처리 미흡)
2025년판 신설. 비정상 상황을 막고·감지하고·대응하지 못해 열린 채 실패하거나, 상태가 깨지거나, 오류로 정보가 새는 문제.
주요 CWE: 636 실패 시 열림 · 252 반환값 미확인 · 754·703·755 예외 조건 확인·처리 실패 · 209·550 오류 메시지 속 민감 정보 · 460 예외 시 정리 누락 · 248 잡히지 않은 예외 · 476 null 역참조 · 478 기본 분기 누락

### 체크리스트
- **A10-1 실패 시 열림(CWE-636)**: 인증·권한·상한·동의·서명 검사가 오류에서 닫히는지 하나씩 본다. `getOptionalUser`의 catch → null(닫힘), `assertDailyLimit` 오류 → INTERNAL(닫힘)처럼 확인하고, `requireConsent`·`getConsentStatus`, `adminEntitlements.get`, `recordAiUsage`(insert 실패 시 경고만 하면 그 호출은 상한에 안 세어짐), proxy의 client 생성 실패 분기, 웹훅 검증 예외를 본다. `catch {}`·`catch { return true }`·`?? true`·기본 허용을 Grep한다. 보안 검사가 열린 채 실패하면 🟠, 다른 층이 막으면 🟡.
- **A10-2 반환값 미확인(CWE-252)**: supabase-js는 던지지 않고 `{ data, error }`를 돌려준다. `.from(`·`.rpc(`·`.storage` 호출에서 `error`를 받지 않거나 확인하지 않는 곳을 찾는다. 삭제(탈퇴·업로드 삭제·cron 정리)가 실패했는데 성공을 반환하면 🟠(보관 약속 위반). 읽기 오류를 빈 결과로 취급해 판단이 바뀌면 그에 맞게.
- **A10-3 부분 실패·정리(CWE-460)**: 여러 단계 흐름에서 중간 실패 시 상태: 탈퇴(Polar 해지 → Storage 삭제 → auth 삭제 순서와 실패 시 고아 파일), 업로드 삭제(행 cascade + Storage), confirm(거래 upsert 뒤 분류 실패 시 `status`), cron(삭제 성공 뒤에만 `original_deleted_at` 기록). 고아·불일치가 남으면 🟡~🟠.
- **A10-4 오류 메시지 노출(CWE-209·550)**: 응답은 `ERROR_MESSAGES[code]`만 쓴다. `AppError`의 상세(예: "환경변수 확인 필요: …")가 응답에 나가지 않는다. `handler` 밖에서 `error.message`를 응답에 넣는 곳, Claude·Polar SDK 오류를 그대로 넘기는 곳을 찾는다.
- **A10-5 자원 고갈**: Claude 호출 요청별 timeout과 라우트 `maxDuration`, 파싱 상한, 페이지네이션 루프 종료 조건(`removePrefix`), 요청 body 크기(zod 상한). 공격자가 한 요청으로 서버를 오래 붙잡을 수 있으면 🟡~🟠.
- **A10-6 예외 누락(CWE-248·755·478)**: `handler` 밖 라우트(`webhooks/polar`, `auth/*`)의 미처리 예외, try 없는 `JSON.parse`, enum `switch`의 `default`·`never` 검사 누락, Claude `stop_reason`(`refusal`·`max_tokens`)과 `parsed_output` null 처리 — 이때도 usage가 기록되는가(A06-1과 같이 본다).
- **A10-7 null·누락 값(CWE-476·234)**: 외부 데이터에 `!` 단언이나 `as` 캐스트로 zod를 건너뛰는 곳 → 🟡.

## 심각도 힌트
- 🔴 Pro·동의 검사 없음, 로그·저장소에 거래 내용·비밀번호
- 🟠 상한 없는 Claude 호출, 보안 검사가 열린 채 실패, 실패한 삭제를 성공으로 반환
- 🟡 보안 이벤트 로그 누락, 다층 방어 누락, 고아 데이터
