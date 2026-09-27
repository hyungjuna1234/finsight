#!/bin/bash
# Stop Verify Hook — Stop (Claude Code·Codex 공용)
# 세션이 끝나기 전에 lint → build → test를 돌리고, 실패하면 exit 2로 에이전트에게 되돌려 고치게 한다.
# - package.json이 없으면(스캐폴딩 전) 통과
# - stop_hook_active가 true면(이미 한 번 되돌린 뒤) 무한 루프를 막기 위해 통과

INPUT=$(cat)
ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$ACTIVE" = "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
if [ ! -f "$ROOT/package.json" ]; then
  exit 0
fi

cd "$ROOT" || exit 0

LOG=$(mktemp)
if npm run lint >"$LOG" 2>&1 && npm run build >>"$LOG" 2>&1 && npm run test >>"$LOG" 2>&1; then
  rm -f "$LOG"
  exit 0
fi

{
  echo "STOP VERIFY: lint / build / test 중 실패가 있습니다. 고친 뒤 끝내세요. 마지막 40줄:"
  tail -n 40 "$LOG"
} >&2
rm -f "$LOG"
exit 2
