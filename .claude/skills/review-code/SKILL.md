---
name: review-code
description: 변경 범위를 차원별 리뷰 에이전트(security·privacy·tests)로 동시에 리뷰하고, docs/REVIEW_GUIDE.md 형식으로 판정·요약·인라인 코멘트를 낸다. 사용자가 /review-code로 부를 때만 쓴다.
argument-hint: "[범위, 예: c6026e3..ce46fd4. 비우면 자동]"
disable-model-invocation: true
---

차원별 리뷰 에이전트를 동시에 띄워 리뷰하고, 결과를 합쳐 판정한다. 인자: `$ARGUMENTS`

- 심각도·판정·출력 형식은 `docs/REVIEW_GUIDE.md`를 따른다. 먼저 읽는다.
- 이 스킬은 메인 세션에서 실행한다(`context: fork` 없이). 메인이 에이전트 결과를 모아 판정하고 바로 보고한다.
- 규칙 준수 체크리스트는 `/review`, 정확성 버그는 기본 제공 `/code-review`가 따로 맡는다.

## 차원

| 차원 | 에이전트(`subagent_type`) |
|---|---|
| security | `review-security` |
| privacy | `review-privacy` |
| tests | `review-tests` |

차원을 늘릴 때는 `.claude/agents/review-<차원>.md`를 만들고 이 표에 한 줄을 더한다.

## 1. 범위

`bash scripts/review-range.sh $ARGUMENTS`를 실행한다. stdout이 범위, stderr가 그 이유다.
- exit 3 → 리뷰할 새 변경이 없다. 그렇게 알리고 끝낸다.
- exit 2 → 인자가 잘못됐다. 범위를 다시 묻는다.
- 추측으로 범위를 정하지 않는다.

## 2. 재료 모으기 (메인은 diff 본문을 읽지 않는다)

| | 범위가 `HEAD`(커밋 안 된 변경) | 그 밖의 범위 |
|---|---|---|
| diff 명령 | `git diff HEAD -- <경로>` | `git diff <범위> -- <경로>` |
| 변경 파일 | `git diff --name-only HEAD` + 새 파일 `git ls-files --others --exclude-standard`(`git status --short`는 새 폴더를 폴더째로만 보여 준다) | `git diff --name-only <범위>` |
| 개요 | `git diff --stat HEAD` | `git diff --stat <범위>`, `git log --format='%h %s' <범위>` |

**파일 읽기 기준**: 범위의 끝 커밋이 `HEAD`와 같으면(`HEAD`, `main...HEAD`, `<base>..HEAD` 등) "작업 트리". 아니면 `git rev-parse --short <끝>`으로 해시를 구해 "`git show <해시>:<경로>`"로 정한다. 끝이 `HEAD`인지는 `git rev-parse <끝>`과 `git rev-parse HEAD`를 비교해 확인한다.

## 3. 동시 실행 (한 메시지에서)

한 메시지 안에서 아래를 모두 시작한다.
- **verify**: 파일 읽기 기준이 "작업 트리"면 `bash scripts/verify.sh --clean`을 같은 메시지에서 **포그라운드**로(timeout 600000) 돌린다. Agent 호출은 바로 반환되므로 에이전트는 verify와 동시에 돈다. `run_in_background`로 돌리면 verify가 끝나기 전에 턴이 끝나고, Stop 훅의 `next build`와 부딪혀 "Another next build process is already running"으로 실패한다. 과거 범위면 돌리지 않고 요약에 "verify 생략(과거 범위)"이라고 적는다. 에이전트는 verify를 돌리지 않는다(`.next`가 충돌한다).
- **차원 에이전트**: 위 표의 에이전트마다 Agent 호출을 하나씩 한다. 프롬프트:

```
범위: <범위> (<이유>)
diff 명령: <2의 diff 명령>
파일 읽기: <작업 트리 | git show <해시>:<경로>>
변경 파일:
<목록, 한 줄에 하나>
새 파일(diff에 안 나오니 전체를 읽는다):
<HEAD 범위의 새 파일 목록. 없으면 이 두 줄을 뺀다>

docs/REVIEW_GUIDE.md의 "차원 에이전트 보고" 형식으로 보고하라.
```

## 4. 합치기

- `file:line` 근거가 없는 지적은 버린다.
- 같은 파일에서 원인이 같은 지적은 줄이 달라도 하나로 합친다(예: 같은 정규식 때문에 생긴 문제를 security는 정의한 줄, privacy는 쓰는 줄에서 보고). 위치는 원인이 있는 줄, 심각도는 높은 쪽, 차원은 모두 적는다.
- nit가 차원당 3개를 넘으면 앞의 3개만 남긴다.
- 메인은 지적을 새로 만들거나 심각도를 바꾸지 않는다.
- 에이전트가 실패하거나 보고 형식을 지키지 않으면 그 차원만 한 번 다시 띄운다. 또 실패하면 요약에 "<차원> 리뷰 못 함"이라고 적고, 판정은 Approve를 내지 않는다.

## 5. 출력

`docs/REVIEW_GUIDE.md`의 "전체 요약"을 먼저, 그다음 인라인 코멘트를 파일별로(파일 안에서는 심각도순) 쓴다.
- **판정**: 가이드의 판정 표대로 개수와 verify 결과로만 정한다. verify가 아직 안 끝났으면 기다린다.
- **Walkthrough**: 2의 개요(커밋 메시지·diff stat)로 2~3줄.
- **잘된 점**: 에이전트 보고에서 2~3개.
- **다음 액션**: critical·major를 고칠 순서와 확인할 테스트, 그리고 고친 뒤 `/review-code` 다시 실행. 변경 파일이 10개를 넘으면 `/code-review`(정확성)도 권한다.

## 6. 기록하지 않는다

`docs/reviews/`에 쓰지 않는다. `review-range.sh`는 그 기록으로 `/review`의 다음 범위를 정하므로, 세 차원만 본 결과를 남기면 `/review`가 그 범위를 건너뛴다. `/review`를 흡수할 때 기록도 이 스킬로 옮긴다.

## 7. 헤드리스 실행 (`scripts/review_code.py`)

pre-push 훅과 GitHub Actions는 `python3 scripts/review_code.py <범위>`로 이 스킬을 `claude -p`에서 부른다. 시스템 프롬프트에 "헤드리스 실행"이 있으면 1~4는 그대로 하고, 5 대신 아래를 따른다.
- 에이전트 세 개가 모두 보고한 뒤에만 구조화 출력을 낸다. 먼저 끝난 차원만으로 결과를 내지 않는다.
- 시스템 프롬프트에 `REVIEW_VERIFY=PASS` 또는 `REVIEW_VERIFY=FAIL`이 있으면 verify.sh를 돌리지 않고 그 값을 쓴다(CI의 verify job 결과).
- Bash 명령은 하나씩 실행한다. `;`·`&&`로 잇지 않는다. 허용 규칙이 명령 단위라서 이어 붙이면 거부된다.
- 구조화 출력은 `scripts/review-schema.json`을 따른다: `dimensions`(표의 차원), `verify`(PASS·FAIL·SKIPPED), `failed_dimensions`, `walkthrough`, `good_points`, `next_actions`, `comments`(4의 합친 결과, `body`는 인라인 4줄).
- 판정·개수·요약 머리말은 실행기가 `comments`의 심각도와 verify 결과로 계산하므로 내지 않는다.
