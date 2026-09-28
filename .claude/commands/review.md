이 프로젝트의 변경 사항을 리뷰하라. 인자: `$ARGUMENTS` (리뷰 범위. 예: `c6026e3..ce46fd4`. 비어 있으면 자동으로 정한다)

이 리뷰는 **규칙 준수**를 본다. 정확성 버그 탐색은 기본 제공 `/code-review`가 맡는다. 변경 파일이 10개를 넘으면 끝에 `/code-review`도 돌리라고 권하라.

## 1. 범위 정하기

`bash scripts/review-range.sh $ARGUMENTS`를 실행한다. stdout이 범위, stderr가 그 이유다.
- `HEAD` → 커밋 안 된 변경이다. `git diff HEAD`와 함께 `git status --short`로 새 파일도 본다.
- exit 3 → 리뷰할 새 변경이 없다. 그렇게 알리고 끝낸다.
- exit 2 → 인자가 잘못됐다. 사용자에게 범위를 다시 묻는다.

출력 첫 줄에 범위와 이유를 적는다. 추측으로 범위를 정하지 않는다.

## 2. 문서 읽기
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

## 3. 변경 확인
`git diff --stat <범위>`, `git diff <범위>`. 구현 파일과 테스트 파일을 둘 다 읽는다.
- 경로 인자는 `supabase/`처럼 슬래시를 붙여라. bash-guard가 인자 속 `supabase` 단어를 CLI 실행으로 보고 막는다.

## 4. 검증
`bash scripts/verify.sh --clean`(lint → test → build, 단계별 PASS/FAIL). `--clean`은 `.next`를 지워서 워크트리 산출물이 메인 lint에 잡히지 않게 한다.
- 워크트리에 `node_modules`가 없으면 먼저 `bash scripts/worktree-init.sh`.
- `scripts/` 아래 파이썬·셸이 바뀌었으면 `pytest scripts/`도 돌린다(pytest가 없으면 임시 venv).

## 5. 체크리스트

1. **아키텍처 준수**: ARCHITECTURE.md의 디렉토리 구조와 레이어 방향을 따르는가? 새 admin 함수는 `server/admin.ts`에 있고 문서 목록에도 있는가?
2. **기술 스택 준수**: ADR을 벗어나지 않았는가? `package.json` 의존성이 늘지 않았는가?
3. **테스트 존재**: 바뀐 동작마다 같은 폴더에 테스트가 있는가(`__tests__/` 금지)?
4. **테스트 품질**: 테스트가 규칙(불변식)을 검사하는가, 아니면 mock 호출 순서만 굳히는가? 호출 순서를 기대값으로 박은 테스트는 그 순서가 규칙에 맞는지 따진다.
   (실제 사례: 인사이트 테스트가 `claude → save → usage` 순서를 고정해서, 저장이 실패하면 `ai_usage` 기록이 빠지는 버그가 테스트를 통과했다.)
5. **CRITICAL 규칙** — 항목마다 따로 판정하고 근거를 `file:line`으로 적는다. 해당 없는 항목은 "해당 없음".
   - 5a **레이어**: `lib/**` 순수, `components/**`는 props만(+`apiFetch`), 브라우저 Supabase client 없음, admin client는 `server/admin.ts`만
   - 5b **비밀키**: 비밀 env는 `server/env.ts`(server-only)에서만, `NEXT_PUBLIC_`은 3개만, env 없이 build 통과
   - 5c **RLS**: 새 테이블·컬럼에 본인 행 정책, `entitlements`는 admin만 쓰기, `anon` 권한 회수, 사용자가 바꿀 수 있는 컬럼을 서버가 믿지 않는가
   - 5d **쓰기 경로**: Route Handler + `handler()`만, GET 부작용 없음, queries 첫 줄 `requireUser()`, 리다이렉트는 `safeRedirect()`
   - 5e **Pro·AI 호출**: `requirePro()`(서버), Claude 호출 전 `requireConsent()`와 일일 상한, 호출 **직후** `ai_usage` 기록 — 뒤 단계(저장 등)가 실패해도 기록되는가
   - 5f **Claude 최소 데이터**: 매핑=마스킹 헤더+샘플 5행, 분류=가맹점명, 인사이트=집계값, 채팅 도구=30행 이하. 출력은 zod·enum 검증, 마크다운 허용 목록(`img`·`a` 금지), 투자·세무 조언 거절
   - 5g **로그**: 거래·가맹점·금액·파일 내용·프롬프트·DB 에러 상세 없음(코드·ID·개수만)
6. **빌드 가능**: `verify.sh` 결과(lint · test 수 · build)

## 6. 출력 형식

범위: `<범위>` (<이유>)

| 항목 | 결과 | 비고 |
|------|------|------|
| 아키텍처 준수 | ✅/❌ | {상세} |
| 기술 스택 준수 | ✅/❌ | {상세} |
| 테스트 존재 | ✅/❌ | {상세} |
| 테스트 품질 | ✅/❌ | {상세} |
| 5a 레이어 | ✅/❌/— | {file:line} |
| 5b 비밀키 | ✅/❌/— | {file:line} |
| 5c RLS | ✅/❌/— | {file:line} |
| 5d 쓰기 경로 | ✅/❌/— | {file:line} |
| 5e Pro·AI 호출 | ✅/❌/— | {file:line} |
| 5f Claude 최소 데이터 | ✅/❌/— | {file:line} |
| 5g 로그 | ✅/❌/— | {file:line} |
| 빌드 가능 | ✅/❌ | {lint · 테스트 수 · build} |

위반 사항이 있으면 수정 방안을 구체적으로 제시하라(어느 파일의 무엇을 어떻게, 어떤 테스트로 확인할지).

## 7. 기록

커밋된 범위를 리뷰했으면 결과를 `docs/reviews/YYYY-MM-DD-<짧은 이름>.md`에 저장한다(KST 날짜).
- 첫 줄 `# <제목>`, 셋째 줄 ``범위: `<base>..<head>` `` — `review-range.sh`가 이 줄로 다음 리뷰의 시작점을 찾는다.
- `main...HEAD`처럼 기호로 된 범위는 `git rev-parse --short`로 두 끝을 커밋 해시로 바꿔 적는다(`main...HEAD`의 base는 `git merge-base main HEAD`).
- 그 아래에 결과 표, 후속 조치(고친 커밋 해시 또는 "미룸"과 이유)를 적는다.
- 커밋 안 된 변경(`HEAD`)만 리뷰했으면 기록하지 않는다.
