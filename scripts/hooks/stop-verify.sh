#!/bin/bash
# Stop Verify Hook — Stop (Claude Code·Codex 공용)
# 세션이 끝나기 전에 scripts/verify.sh(lint → test → build)를 돌리고, 실패하면 exit 2로 에이전트에게 되돌려 고치게 한다.
# - 검증 대상은 세션의 작업 트리다(훅 입력의 cwd). 워크트리 세션이면 메인이 아니라 그 워크트리를 검증한다.
# - package.json이 없으면(스캐폴딩 전) 통과
# - stop_hook_active가 true면(이미 한 번 되돌린 뒤) 무한 루프를 막기 위해 통과
# - REVIEW_CODE_HEADLESS=1이면 통과. 헤드리스 리뷰(scripts/review_code.py)는 읽기 전용이고 verify를 직접 다룬다
# - 마지막 통과 이후 작업 트리 내용이 그대로면 통과(트리 해시를 git 디렉터리의 verify-ok에 기록)
# - --defer-to-harness: execute.py가 이 체크아웃에서 도는 중이면(harness.lock의 PID가 살아 있으면) 통과.
#   Codex가 작업 중인 트리를 검증하지 않도록 Claude Code(.claude/settings.json)만 이 옵션을 붙인다.

HERE=$(cd "$(dirname "$0")" && pwd)
INPUT=$(cat)
ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

if [ "$ACTIVE" = "true" ] || [ "${REVIEW_CODE_HEADLESS:-}" = "1" ]; then
  exit 0
fi

CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
ROOT=""
[ -n "$CWD" ] && ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
[ -z "$ROOT" ] && ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
if [ ! -f "$ROOT/package.json" ]; then
  exit 0
fi

cd "$ROOT" || exit 0

if [ "${1:-}" = "--defer-to-harness" ]; then
  LOCK=$(git rev-parse --git-path harness.lock 2>/dev/null)
  if [ -n "$LOCK" ] && [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
    exit 0
  fi
fi

# 작업 트리 전체(추적 파일 + 무시되지 않은 새 파일)의 트리 해시. 임시 인덱스를 써서 실제 인덱스는 건드리지 않는다.
# .git에 쓸 수 없는 곳(Codex 샌드박스)에서는 빈 값을 돌려주고, 그러면 매번 검증한다.
tree_hash() {
  local tmp hash=""
  tmp=$(mktemp -d) || return 0
  cp "$(git rev-parse --git-path index)" "$tmp/index" 2>/dev/null
  if GIT_INDEX_FILE="$tmp/index" git add -A >/dev/null 2>&1; then
    hash=$(GIT_INDEX_FILE="$tmp/index" git write-tree 2>/dev/null)
  fi
  rm -rf "$tmp"
  echo "$hash"
}

CACHE=$(git rev-parse --git-path verify-ok 2>/dev/null)
BEFORE=$(tree_hash)
if [ -n "$BEFORE" ] && [ -n "$CACHE" ] && [ "$(cat "$CACHE" 2>/dev/null)" = "$BEFORE" ]; then
  exit 0
fi

LOG=$(mktemp)
if bash "$HERE/../verify.sh" >"$LOG" 2>&1; then
  # 검증하는 동안 트리가 바뀌었으면(다른 에이전트가 작업 중) 기록하지 않는다.
  [ -n "$BEFORE" ] && [ -n "$CACHE" ] && [ "$(tree_hash)" = "$BEFORE" ] && echo "$BEFORE" > "$CACHE" 2>/dev/null
  rm -f "$LOG"
  exit 0
fi

FAILED=$(sed -n 's/^FAIL //p' "$LOG" | head -n 1)
{
  echo "STOP VERIFY: ${FAILED:-verify} 실패 ($ROOT). 고친 뒤 끝내세요. 마지막 40줄:"
  tail -n 40 "$LOG"
} >&2
rm -f "$LOG"
exit 2
