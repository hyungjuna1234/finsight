---
name: perf-loop
description: 로그인 없이 보는 PUB 페이지(/, /demo, /pricing, /guide, /refund, /privacy, /terms, /login)의 Lighthouse Performance 점수를 한 사이클(측정→판정→필요하면 최적화 1건 적용→기록)만 돌린다. 여러 사이클을 반복하려면 /loop /perf-loop로 묶어서 쓴다. 사용자가 /perf-loop로 부를 때만 쓴다.
argument-hint: "[목표 평균 점수] (비우면 90)"
disable-model-invocation: true
---

PUB 8개 페이지의 Lighthouse Performance 점수를 올린다. 인자: `$ARGUMENTS` (목표 평균 점수, 비우면 90)

- autoresearch(`modify → 고정 트라이얼 측정 → 지표 비교 → keep/discard → 반복`) 구조를 그대로 쓰되, LLM 크리틱 대신 Lighthouse 점수(객관적 숫자)로 평가한다.
- **이 스킬 한 번 호출 = 정확히 한 사이클**이다. 반복은 이 스킬이 하지 않는다 — `/loop /perf-loop`로 묶어서 CONTINUE/STOP 보고가 나올 때까지 턴을 다시 호출한다.
- **범위는 PUB 페이지뿐**이다. `/dashboard` 등 로그인이 필요한 APP 페이지는 이 레포(harness-only 체크아웃, 실 Supabase/Anthropic/Polar env 없음)에서 측정할 수 없다 — `finsight-ops/`에서 사람이 같은 스크립트로 따로 돌려야 한다.
- 새 npm 의존성을 추가하지 않는다. Lighthouse는 `npx --yes lighthouse`로 실행한다(사용자 승인됨 — package.json/lock은 건드리지 않고 npm 캐시에만 받는다).
- 커밋 방식은 사용자 승인됨: 점수가 개선되면 자동으로 `perf:` 커밋, 악화되면 자동으로 `git restore`.

## 1. 시작
1. `docs/perf/lighthouse-history.md`가 있는지 확인한다. 없으면 **첫 baseline 실행**이다(최적화 적용 없이 1~6단계만 돈다).
2. 있으면 마지막 섹션에서 직전 run 디렉터리 경로, 직전 평균 점수, 지금까지의 iteration 번호, 최근 kept iteration들의 평균 점수 개선치(정체 판단용), "폐기됨" 목록(같은 시도 반복 방지용)을 읽어둔다.
3. `AGENTS.md`의 "아키텍처 규칙"을 상기한다(레이어 규칙, 새 의존성 금지, TDD).

## 2. 안전 점검
- `git status --short`로 작업트리가 깨끗한지 확인한다. 더러우면(이 스킬이 남긴 게 아니라면) 사용자에게 알리고 멈춘다 — 다른 작업 중일 수 있다.
- 측정은 `scripts/run-lighthouse.sh`가 자체적으로 하네스 잠금(`harness.lock`)·포트 점유·동시 빌드를 점검하고 실패하면 exit 2로 끝낸다. exit 2면 이유를 그대로 사용자에게 보여주고 멈춘다(재시도하지 않는다).

## 3. 측정
현재 세션 스크래치패드 디렉터리 아래 `perf-loop/run-<타임스탬프>/`를 run 디렉터리로 쓴다(레포 안에 두지 않는다 — 리포트는 매번 크고 일회성이다).

```
bash .claude/skills/perf-loop/scripts/run-lighthouse.sh --run-dir "<run-dir>"
```
반드시 **foreground**로 돌린다(백그라운드 금지 — `owasp-scan`의 probe.sh와 같은 이유로 Stop 훅의 `next build`와 경합하면 안 된다). 8개 중 일부 route가 `ROUTE_FAIL`이어도 계속 진행하되, 그 페이지는 이번 iteration에서 "측정 실패"로 기록한다.

## 4. 판정
```
node .claude/skills/perf-loop/scripts/parse-report.mjs "<이번 run-dir>" "<직전 kept run-dir>"
```
(baseline이면 직전 run-dir 없이 호출 — 이번엔 비교할 게 없으니 `average.delta`는 null)

출력 JSON의 `pages`·`average`·`regressions`·`topOpportunities`를 읽고 다음을 정한다:

- **baseline**이면: keep/discard 판단 없이 그대로 기록만 하고 5단계(분석+수정)로 간다.
- **baseline이 아니면**:
  - `regressions`가 비어있지 않으면(한 페이지라도 3점 초과 악화) → **discard**: `git status --short`로 바뀐 파일을 확인하고 `git restore <파일들>`로 되돌린다(추가했던 테스트 파일도 함께). 리포트 리포트에 "폐기됨: <audit id> — <페이지>에서 악화"로 적는다.
  - `regressions`가 비어있고 `average.delta >= 0`이면 → **keep**: `git add <바뀐 파일들>` 후 `git commit -m "perf: <한 줄 설명> (Lighthouse <audit id>, PUB 평균 ${average.delta}pt)"`.
  - 그 외(`average.delta < 0`이지만 개별 regression 기준엔 안 걸림, 즉 전반적으로 미세하게 나빠짐) → **discard** (위와 동일하게 restore).
- 다음 **멈출 조건**을 kept 상태 기준으로 확인한다 — 하나라도 맞으면 6·7단계로 가서 **STOP**으로 보고하고 끝낸다:
  1. `average.score >= 목표`(인자, 기본 90) → "목표 달성"
  2. 최근 kept iteration 2번(이번 포함) 모두 `average.delta < 1.0` → "정체" (history에서 직전 kept delta를 가져와 이번 것과 함께 판단)
  3. 전체 iteration 번호가 10에 도달 → "최대 iteration"
  멈출 조건에 안 걸리면 **CONTINUE**로 5단계를 진행한다.

## 5. 분석 + 수정 (baseline이거나 discard로 끝난 iteration이 아니라, CONTINUE일 때만)
1. `Agent` 도구로 `perf-analyzer` 서브에이전트를 **1개만** 호출한다. 입력으로 4단계의 `parse-report.mjs` JSON 전체와 `docs/perf/lighthouse-history.md`의 "폐기됨" 목록을 준다.
2. 제안을 받으면:
   - 제안이 "제안 없음"이면 → 정체로 간주하고 6·7단계에서 STOP("더 안전한 최적화 후보 없음", 남은 `topOpportunities`를 수동 후속 작업으로 함께 보고).
   - 제안이 있으면: 대상 파일이 `src/lib/**`·`src/components/**`이고 sibling 테스트가 없다고 분석가가 말했으면, **먼저** 분석가가 제안한 최소 테스트를 Write(실패하는 테스트)한다. 그다음 실제 변경을 Edit으로 적용한다(`next.config.ts`·`page.tsx`·`layout.tsx`는 TDD 가드 예외이므로 바로 Edit 가능).
3. `npm run lint && npm run test`를 돌린다. 실패하면 **즉시 discard**(이번 iteration에서 만든 Write/Edit을 모두 `git restore` — 커밋 전이라 lighthouse를 다시 돌릴 필요 없다)하고, "폐기됨: <audit id> — lint/test 실패"로 기록한 뒤 끝낸다(이번 사이클은 여기서 종료, 점수 변화 없음 — 다음 호출에서 같은 baseline으로 다시 측정).
4. lint/test가 통과하면 — **이번 사이클은 여기서 끝**이다. 다음 사이클(다음 `/perf-loop` 호출)의 3단계 측정이 이 변경을 반영해 점수를 재측정하고, 4단계가 keep/discard를 판정한다.

## 6. 기록
`docs/perf/lighthouse-history.md`에 아래 형식으로 **이번 iteration 섹션을 추가**한다(파일이 없으면 헤더부터 새로 만든다):

```
# Lighthouse 성능 루프 기록

마지막 run-dir: <경로> · 마지막 kept 평균 점수: <N> · 다음 iteration: <N+1>

## Iteration <N> — YYYY-MM-DD HH:MM KST
| 페이지 | 점수(전) | 점수(후) | Δ |
|---|---|---|---|
| / | 72 | 76 | +4 |
| ... | | | |

평균: 전 <N> → 후 <N> (Δ <N>)
대상 audit: <id> (저장 가능 ~<N>ms)
결과: kept (commit <sha>) | discarded (<이유>) | baseline
```
새 섹션은 파일 맨 위(헤더 바로 아래)에 추가해 최신이 먼저 보이게 한다. 이 파일은 `perf-analyzer`가 "폐기된 시도"를 읽는 유일한 영속 자료이므로 discard 이유를 구체적으로(audit id + 무엇이 나빠졌는지) 적는다.

## 7. 보고
짧게 한 블록으로:
```
Iteration <N>: PUB 평균 <전>→<후> (Δ<N>) · <kept/discarded/baseline>
<CONTINUE | STOP: <이유>>
```
STOP이면 남은 상위 opportunities(있으면)와, PUB 범위 밖이라 다루지 못한 APP 페이지 성능은 `finsight-ops/`에서 수동으로 봐야 한다는 점을 한 줄로 덧붙인다.
