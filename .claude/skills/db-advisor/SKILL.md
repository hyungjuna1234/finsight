---
name: db-advisor
description: Supabase MCP의 Get Advisors(보안+성능)로 FinSight DB를 점검하고 docs/security/db-advisor-*.md에 보고한다. 마이그레이션으로 고칠 수 있는 항목은 사용자가 고르면 새 마이그레이션 파일(+필요시 PGlite 테스트)까지 작성한다. 사용자가 /db-advisor로 부를 때만 쓴다.
argument-hint: "[security|performance] (비우면 둘 다)"
disable-model-invocation: true
---

Supabase Advisors(보안·성능)로 DB를 점검한다. 인자: `$ARGUMENTS`

- 코드 레벨 감사는 `/owasp-scan`, 변경분 리뷰는 `/review-code`가 맡는다. 이 스킬은 **Supabase 자체 보안·성능 린트(advisors) 전용**이고, 사용자가 고칠 항목을 고르면 **마이그레이션 파일까지 작성**하는 이 레포의 유일한 "보고 → 수정 적용" 스킬이다.
- 실제 원격 DB에는 아무것도 쓰지 않는다. `mcp__supabase__execute_sql`이나 `supabase`/`psql` CLI로 원격에 직접 적용하지 않는다(이 복사본에서 CLI는 쓸 수도 없다 — `ops/README.md`). 쓰기는 `supabase/migrations/*.sql` 파일 작성뿐이고, 원격 반영은 사람이 `finsight-ops/` 클론에서 `git pull` 후 CLI push 한다.
- 심각도 아이콘은 `docs/REVIEW_GUIDE.md`를 따른다(🔴critical 🟠major 🟡minor ⚪nit).
- 비밀 값·거래 데이터는 advisors 결과에 나오지 않지만, 혹시 상세(detail)에 섞여 있으면 그대로 출력하지 않는다.

## 1. 준비

1. ToolSearch로 `mcp__supabase__list_projects`, `mcp__supabase__get_advisors`, `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`를 불러온다.
2. `list_projects`에서 이름이 `finsight`인 프로젝트의 `project_id`를 구한다. 없거나 여러 개면 사용자에게 묻는다.
3. `docs/security/accepted-risks.md`를 읽고 가장 큰 `AR-nn` 번호를 확인한다(다음 수용 항목은 그 다음 번호).
4. 직전 보고서: `ls docs/security/db-advisor-*.md | sort | tail -1` (없으면 첫 점검).
5. 드리프트 확인: `list_migrations(project_id)` 결과와 로컬 `supabase/migrations/*.sql` 파일명을 비교한다. 로컬에만 있는 파일이 있으면 "원격에 아직 반영 안 된 마이그레이션 N개"라고 적는다. 원격에만 있는 버전이 있으면 "로컬에 없는 원격 마이그레이션"이라고 적고, advisors 결과가 로컬 스키마와 다를 수 있다고 경고한다.

## 2. 조회

- 인자가 `security`면 `get_advisors(type:"security")`만, `performance`면 그것만, 비었으면 둘 다 호출.
- `list_tables(schemas:["public"], verbose:false)`로 테이블별 `rows`를 받아둔다(3단계 분류에 쓴다).

## 3. 분류

각 lint를 아래 중 하나로 분류한다. `name`으로 먼저 판단하고, 모르는 lint는 `description`을 보고 가장 가까운 쪽에 넣되 애매하면 "판단 보류"로 보낸다.

- **마이그레이션으로 고칠 수 있음**: 테이블·정책·인덱스·스키마 구조 문제. 예: `rls_disabled`, `rls_enabled_no_policy`, `policy_exists_rls_disabled`, `no_primary_key`, `unindexed_foreign_keys`, `duplicate_index`, `security_definer_view`, `function_search_path_mutable`, `extension_in_public`, `rls_references_user_metadata`.
- **설정으로만 고칠 수 있음 (이 스킬 범위 밖)**: `auth_`로 시작하는 전부(`auth_leaked_password_protection`, `auth_otp_long_expiry`, `auth_mfa_*` 등)와 그 밖의 프로젝트 설정류. 이 MCP 서버엔 Management API 쓰기 도구가 없으므로 remediation 링크만 걸고 "Supabase 대시보드에서 사람이"라고 적는다.
- **판단 보류**: `unused_index`인데 대상 테이블의 `rows`가 거의 0이면 "데이터가 없어 사용 여부를 판단할 수 없다"고 적고 삭제를 권하지 않는다. 그 외 분류가 애매한 INFO도 여기로.

## 4. 심각도

advisors `level` → 이 레포 아이콘: `ERROR`→🔴, `WARN`→🟠, `INFO`(마이그레이션으로 고칠 수 있음)→🟡, `INFO`(판단 보류 또는 설정 전용 관찰성)→⚪.

## 5. 직전 보고서 대비

직전 `db-advisor-*.md`의 "지적 목록"과 이번 걸 lint `name` + 대상(테이블/함수 등)으로 비교해 신규·지속·해결로 나눈다. `accepted-risks.md`와 같은 지적이면 "수용됨"으로 옮긴다. 수용 조건이 깨졌으면 지적으로 남기고 그 사실을 적는다(`/owasp-scan`과 동일 규칙).

## 6. 출력

`docs/security/db-advisor-YYYY-MM-DD.md`(KST, 같은 날 파일이 있으면 `-2`)에 아래 템플릿으로 쓴다. 커밋은 하지 않는다.

```
# DB 어드바이저 — YYYY-MM-DD
Supabase `finsight` (`<project_id>`) · ap-northeast-2 · 마이그레이션 드리프트: 없음 | <내용> · 직전 점검 YYYY-MM-DD | 첫 점검

## 요약
🔴 N · 🟠 N · 🟡 N · ⚪ N · 수용됨 N

## 마이그레이션으로 고칠 수 있음
| 심각도 | lint | 대상 | 설명 |
|---|---|---|---|

## 설정으로만 고칠 수 있음 (사람이 대시보드/Management API)
| 심각도 | lint | 대상 | remediation |
|---|---|---|---|

## 판단 보류
| lint | 대상 | 보류 이유 |
|---|---|---|

## 수용됨
- AR-nn ...

## 직전 점검 대비
- 신규: … / 해결: … (첫 점검이면 생략)

## 상세
(각 항목: lint description/findings[].detail 원문 + 왜 이 분류인지 한 줄 + remediation 링크)
```

터미널에는 요약과 "마이그레이션으로 고칠 수 있음" 표만 보여주고, 나머지는 파일 경로로 안내한다.

## 7. 수정 항목 고르기

"마이그레이션으로 고칠 수 있음" 표를 번호와 함께 보여주고, 사용자에게 지금 고칠 항목을 고르게 한다. 아무것도 안 고르면 보고서만 남기고 끝낸다.

## 8. 마이그레이션 작성

고른 항목마다:

- `supabase/migrations/<KST 지금을 YYYYMMDDHHMMSS로>_<설명>.sql`을 새로 만든다. `20260926000000_init.sql`의 패턴을 그대로 따른다: 권한 변경이 필요하면 `revoke all ... from anon, authenticated` 뒤 필요한 권한만 `grant`, 정책은 `create policy ... using ((select auth.uid()) = user_id)` 형태, 인덱스는 `create index <table>_<cols>_idx on public.<table> (<cols>)`.
- RLS 정책을 새로 추가하거나 바꾸는 수정은 `supabase/tests`에 PGlite 격리 테스트를 먼저 실패하는 형태로 추가한 뒤(AGENTS.md TDD 규칙) 마이그레이션을 작성해 통과시킨다.
- 순수 인덱스 추가처럼 동작이 바뀌지 않는 수정은 별도 테스트 없이 작성하고, `npm run test`로 PGlite가 새 마이그레이션까지 끝까지 적용되는지만 확인한다.
- `execute_sql`이나 CLI로 원격에 직접 적용하지 않는다.
- 다 쓰면 "마이그레이션 작성 완료: `<파일 경로>`. `finsight-ops/`에서 `git pull` 후 `supabase db push`로 반영하세요"라고 알린다.

## 9. 수용 처리

사용자가 특정 항목을 "수용"하기로 하면 `docs/security/accepted-risks.md`에 다음 번호로 추가한다: 위치, 위험, 수용 이유, (조건), 재검토 조건, 수용일(오늘, KST). 사용자가 명시적으로 말했을 때만 추가한다.
