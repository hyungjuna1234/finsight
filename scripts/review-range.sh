#!/bin/bash
# Review Range — /review가 볼 git 범위를 정해 stdout에 한 줄로 출력한다. 왜 그 범위인지는 stderr에 쓴다.
# 순서: 인자 → 커밋 안 된 변경(`HEAD`, 즉 git diff HEAD) → main에 없는 브랜치 커밋(`main...HEAD`)
#       → 마지막 리뷰 기록 이후(docs/reviews/*.md의 "범위: `BASE..HEAD`" 줄) → 마지막 completed phase의 커밋
# exit 0 범위 출력 · 2 알 수 없는 범위 인자 · 3 리뷰할 새 변경 없음

ROOT=$(git rev-parse --show-toplevel) || exit 1
cd "$ROOT" || exit 1

if [ $# -gt 0 ]; then
  if git rev-list -n 1 "$1" -- >/dev/null 2>&1; then
    echo "$1"
    echo "인자로 받은 범위" >&2
    exit 0
  fi
  echo "review-range.sh: 알 수 없는 범위 $1" >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "HEAD"
  echo "커밋 안 된 변경 (새 파일은 git status로 따로 확인)" >&2
  exit 0
fi

if git rev-parse --verify -q main >/dev/null && [ "$(git rev-list --count main..HEAD)" -gt 0 ]; then
  echo "main...HEAD"
  echo "main에 없는 브랜치 커밋" >&2
  exit 0
fi

# 리뷰 기록 중 HEAD의 조상이면서 HEAD에 가장 가까운 것을 고른다.
LAST=""
LAST_DISTANCE=""
for RECORD in docs/reviews/*.md; do
  [ -f "$RECORD" ] || continue
  HEAD_OF_RECORD=$(sed -nE 's/^범위: `[^`]*\.\.([0-9a-fA-F]+)`.*/\1/p' "$RECORD" | head -n 1)
  [ -n "$HEAD_OF_RECORD" ] || continue
  git merge-base --is-ancestor "$HEAD_OF_RECORD" HEAD 2>/dev/null || continue
  DISTANCE=$(git rev-list --count "$HEAD_OF_RECORD..HEAD")
  if [ -z "$LAST_DISTANCE" ] || [ "$DISTANCE" -lt "$LAST_DISTANCE" ]; then
    LAST=$HEAD_OF_RECORD
    LAST_DISTANCE=$DISTANCE
  fi
done

if [ -n "$LAST" ]; then
  if git diff --quiet "$LAST" HEAD -- . ':(exclude)docs/reviews'; then
    echo "마지막 리뷰($LAST) 이후 리뷰할 새 변경이 없습니다" >&2
    exit 3
  fi
  echo "$LAST..HEAD"
  echo "마지막 리뷰 기록($LAST) 이후" >&2
  exit 0
fi

PHASE=$(jq -r '[.phases[] | select(.status == "completed")] | last | .dir // empty' phases/index.json 2>/dev/null)
if [ -n "$PHASE" ]; then
  COMMITS=$(git log --format=%H --fixed-strings --grep="($PHASE)")
  FIRST=$(echo "$COMMITS" | tail -n 1)
  NEWEST=$(echo "$COMMITS" | head -n 1)
  if [ -n "$FIRST" ] && BASE=$(git rev-parse --short "$FIRST^" 2>/dev/null); then
    echo "$BASE..$(git rev-parse --short "$NEWEST")"
    echo "마지막 completed phase($PHASE)의 커밋" >&2
    exit 0
  fi
fi

echo "리뷰할 새 변경이 없습니다" >&2
exit 3
