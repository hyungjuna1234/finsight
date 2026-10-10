---
name: owasp-scan
description: OWASP Top 10:2025 기준으로 FinSight 전체 코드베이스를 보안 감사한다. 카테고리 묶음별 에이전트 4개와 npm audit·gitleaks·Supabase advisors·로컬 서버 응답 검사를 돌리고, A01~A10 현황표와 출시 가능 여부를 터미널과 docs/security/에 낸다. 사용자가 /owasp-scan으로 부를 때만 쓴다.
argument-hint: "[경로…] (비우면 전체)"
disable-model-invocation: true
---

OWASP Top 10:2025 기준으로 코드베이스 전체를 감사한다. 인자: `$ARGUMENTS`

- 변경분 리뷰는 `/review-code`, 규칙 체크리스트는 `/review`가 맡는다. 이 스킬은 출시 전·주기 점검용 **전체** 감사다.
- 읽기 전용이다. 코드를 고치지 않는다. 수정은 사용자가 고를 때 AGENTS.md의 TDD로 따로 한다.
- 심각도와 인라인 4줄 형식은 `docs/REVIEW_GUIDE.md`를 따른다. 먼저 읽는다.
- 비밀 값은 어디에도 출력하지 않는다(파일:줄과 종류만). 도구 출력도 같다.

## 묶음

| 그룹 | 카테고리 | 체크리스트 | 도구 결과 |
|---|---|---|---|
| access | A01 접근 제어 실패 · A07 인증 실패 | `references/access.md` | advisors |
| config | A02 보안 설정 오류 · A03 공급망 실패 · A04 암호화 실패 | `references/config.md` | deps, advisors |
| injection | A05 인젝션 · A08 소프트웨어·데이터 무결성 실패 | `references/injection.md` | — |
| design | A06 안전하지 않은 설계 · A09 로깅·알림 실패 · A10 예외 상황 처리 미흡 | `references/design.md` | — |

## 1. 준비

1. 범위: 인자가 없으면 전체. 경로가 있으면 존재하는지 확인하고 그 경로만 본다.
2. 기준: `git rev-parse --short HEAD`, `git status --short`(커밋 안 된 변경도 작업 트리 그대로 읽는다. 있으면 보고서에 적는다).
3. 읽기: `docs/security/accepted-risks.md`, 직전 보고서(`ls docs/security/owasp-*.md | sort | tail -1`, 없으면 첫 스캔).
4. 도구 결과 폴더 `SCAN_DIR`: 세션 scratchpad(없으면 `mktemp -d`).
5. probe 가능 여부: `$(git rev-parse --git-common-dir)/harness.lock`이 있거나 `pgrep -f "next build"`가 잡히면 probe를 생략하고 이유를 적는다. 하네스나 다른 빌드와 `.next`를 같이 쓰면 둘 다 깨진다.

## 2. 빠른 도구 (차례로)

- **deps**: `bash .claude/skills/owasp-scan/scripts/deps.sh > $SCAN_DIR/deps.txt`. npm audit(prod·전체), 설치 스크립트가 있는 패키지, 레지스트리 밖 패키지와 integrity, 사전 배포 버전, gitleaks(없으면 정규식 대체 검사)를 낸다.
- **advisors**: ToolSearch로 `mcp__supabase__list_projects`, `mcp__supabase__get_advisors`를 불러온다. 이름이 `finsight`인 프로젝트에 `type: "security"`로 호출하고, 항목마다 `레벨 · lint 이름 · 대상 · 한 줄 설명`을 `$SCAN_DIR/advisors.txt`에 쓴다. dev DB 상태라서 마이그레이션과 다를 수 있다. 실패하면 "advisors 실행 못 함: <이유>"라고 쓴다.

## 3. 동시 실행 (한 메시지에서)

- **probe**: `bash .claude/skills/owasp-scan/scripts/probe.sh`를 **포그라운드**로(timeout 600000) 돌린다. 더미 env로 프로덕션 빌드를 띄우고 보안 헤더, 인증 없는 API 접근, 위조 세션 쿠키, CSRF(Origin), cron·웹훅 인증, 오픈 리다이렉트, 쿠키 속성, 오류 노출, 번들 속 비밀값을 HTTP로 확인한다. Agent 호출은 바로 반환되므로 에이전트는 probe와 동시에 돈다. `run_in_background`로 돌리면 턴이 먼저 끝나 Stop 훅의 `next build`와 부딪힌다.
- **그룹 에이전트**: 표의 그룹마다 `subagent_type: owasp-scanner`로 Agent를 하나씩 띄운다. 이 세션 시작 뒤에 에이전트 파일이 생겨 타입이 없으면 `general-purpose`로 띄우고 프롬프트 첫 줄에 "`.claude/agents/owasp-scanner.md`를 먼저 읽고 그대로 따른다"를 넣는다. 프롬프트:

```
레포 루트: <git rev-parse --show-toplevel의 절대 경로. 모든 경로는 여기 기준이다>
그룹: <access|config|injection|design>
범위: <전체 | 경로 목록>
기준: <short sha> (커밋 안 된 변경 <있음|없음>, 작업 트리를 읽는다)
체크리스트: .claude/skills/owasp-scan/references/<그룹>.md
도구 결과: <$SCAN_DIR/deps.txt 등, 없으면 "없음">
수용 위험: docs/security/accepted-risks.md

owasp-scanner의 "보고" 형식으로 돌려준다.
```

## 4. 합치기

- `file:line` 근거가 없는 지적은 버린다.
- 원인이 같은 지적은 그룹이 달라도 하나로 합친다. 위치는 원인이 있는 줄, 심각도는 높은 쪽, 카테고리는 모두 적는다.
- **probe FAIL**은 관찰된 동작이라 지적으로 올린다. 심각도는 probe 줄에 적힌 값을 쓴다. 위치는 그 동작을 만드는 코드다: 헤더 → `next.config.ts`, API 경로 → `src/app/<경로>/route.ts`, 보호 페이지 → `src/proxy.ts`, 쿠키 → `src/services/supabase/server.ts`, 번들 속 비밀값 → 그 env를 읽는 곳. 줄은 Grep으로 찾는다. 같은 문제를 에이전트가 ✓로 봤다면 probe 결과를 따른다. probe WARN은 도구 절에만 적는다.
- 수용 위험과 같은 지적은 "수용됨"으로 옮긴다. 재검토 조건이 생겼거나 조건(AR-05 고정, AR-06 integrity)이 깨졌으면 지적으로 남기고 그 사실을 적는다.
- nit는 그룹당 3개까지.
- 메인은 에이전트 지적의 심각도를 바꾸지 않는다.
- 에이전트가 실패하거나 형식을 어기면 그 그룹만 한 번 다시 띄운다. 또 실패하면 "<그룹> 스캔 못 함"으로 두고 해당 카테고리 상태를 `—`로 한다.
- 직전 보고서의 "지적 목록"과 비교해 신규·지속·해결을 나눈다. 카테고리와 파일이 같고 같은 문제면 같은 지적이다.

## 5. 출력

`docs/security/owasp-YYYY-MM-DD.md`(KST 날짜, 같은 날 파일이 있으면 `-2`)에 아래 전체를 쓴다. 터미널에는 "상세"에서 🔴·🟠만 보이고 나머지는 파일 경로로 안내한다. 레포가 공개라서 보고서는 `.gitignore`로 git에서 빠진다(아직 안 고친 약점의 재현 방법이 들어 있다). 커밋하거나 PR·이슈에 붙이지 않는다.

```
# OWASP Top 10:2025 스캔 — YYYY-MM-DD
기준 `abc1234` (커밋 안 된 변경 N개) · 범위 전체 · 직전 스캔 YYYY-MM-DD | 첫 스캔

## 출시 가능: 아니오 (🔴 1)
🔴 1 · 🟠 2 · 🟡 4 · ⚪ 1 · 수용됨 8 · 신규 3 · 해결 1

## 카테고리 현황
| | 카테고리 | 상태 | 🔴 | 🟠 | 🟡 | 수용됨 |
|---|---|---|---|---|---|---|
| A01 | 접근 제어 실패 | ❌ | 1 | 0 | 1 | 1 |
| … (A10까지) |

## 도구
- npm audit: prod critical 0 · high 1 / 전체 …
- gitleaks: 0건 | 미설치(정규식 대체 검사 N건)
- Supabase advisors: ERROR 0 · WARN 2 | 실행 못 함(이유)
- probe: PASS 30 · FAIL 1 · WARN 2 | 생략(이유)

## Critical / Major
1. 🔴 `file:line` 제목 (A01)
(없으면 "없음")

## 수용됨
- AR-01 CSP 'unsafe-inline' (A02) — 유지 | 재검토 필요: <이유>

## 직전 스캔 대비
- 신규: … / 해결: … (첫 스캔이면 생략)

## 수정 제안
1. 고칠 순서, 먼저 쓸 실패 테스트(TDD)
2. 고친 뒤 `/review-code`, 그리고 `/owasp-scan` 다시 실행

## 지적 목록
| 심각도 | 카테고리 | 위치 | 제목 |

## 상세
(파일별, 파일 안에서는 심각도순. REVIEW_GUIDE 인라인 4줄, 제목 줄은 `[🟠 major · A10 CWE-636] 제목`)
```

- **출시 가능**: 🔴가 있으면 "아니오". 스캔 못 한 그룹이 있으면 "판단 보류". 그 밖에는 "예"이고, 🟠가 있으면 "(🟠 N개는 출시 전 수정 권장)"을 붙인다.
- **상태**: ❌ 🔴·🟠 있음 · ⚠️ 🟡만 · ✅ 지적 없음(⚪만) · — 스캔 못 함.
- **개수**: 머리말의 🔴·🟠·🟡·⚪는 합친 뒤의 고유 지적 수다. 현황표에서는 여러 카테고리에 걸친 지적을 카테고리마다 하나씩 세고, 표 아래에 그렇게 적는다.
- **그룹 밖 참고**: 에이전트가 다른 그룹 몫으로 적은 줄은 그 그룹이 같은 문제를 지적했는지 확인하는 데만 쓴다. 그 그룹이 놓쳤으면 그 그룹을 다시 띄우지 말고, 지적 목록에 "(그룹 밖 참고로만 확인, 심각도 미정)"으로 🟡를 달아 남기고 수정 제안에서 확인을 권한다.

## 6. 끝난 뒤

- 어떤 지적을 고칠지 사용자에게 묻는다. 고치기로 한 것은 실패 테스트부터 쓴다.
- 수용하기로 한 지적은 사용자가 말하면 `accepted-risks.md`에 `AR-nn`으로 더한다(위치·위험·수용 이유·재검토·수용일).
