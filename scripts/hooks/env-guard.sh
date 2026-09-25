#!/bin/bash
# Env Guard Hook — PreToolUse[Read|Edit|Write|Bash|Grep|Glob|NotebookEdit]
# .env* 파일(.env.example 제외)을 읽거나 쓰거나 셸로 건드리는 것을 차단한다.
# 이유: harness 세션은 --dangerously-skip-permissions로 돌고 git add -A로 커밋한다.
#       실제 키가 프롬프트·로그·커밋으로 새는 경로를 원천 차단한다. (plan.md 1-2, SEC-2)
# 차단은 exit 2 + stderr (Claude Code는 exit 2만 차단으로 처리한다).

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FIELDS=$(echo "$INPUT" | jq -r '[.tool_input.file_path, .tool_input.path, .tool_input.pattern, .tool_input.glob, .tool_input.notebook_path] | map(select(. != null)) | .[]')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

block() {
  echo "ENV GUARD: '$1' — .env 파일은 읽거나 수정할 수 없습니다. 필요한 변수 이름은 .env.example을 보세요. 실제 키는 사람이 finsight-ops/에서만 다룹니다." >&2
  exit 2
}

is_env_path() {
  local base
  base=$(basename "$1")
  case "$base" in
    .env.example) return 1 ;;
    .env|.env.*|.envrc) return 0 ;;
  esac
  return 1
}

# 파일 경로·패턴 인자 검사
while IFS= read -r value; do
  [ -z "$value" ] && continue
  if is_env_path "$value"; then
    block "$value"
  fi
done <<< "$FIELDS"

# 셸 명령 검사: .env 또는 .env.xxx 토큰이 있으면 차단 (.env.example은 허용)
if [ "$TOOL" = "Bash" ] && [ -n "$COMMAND" ]; then
  STRIPPED=$(echo "$COMMAND" | sed -E 's/\.env\.example//g')
  if echo "$STRIPPED" | grep -qE '(^|[^A-Za-z0-9_])\.env(rc|\.[A-Za-z0-9_-]+)?([^A-Za-z0-9_-]|$)'; then
    block "$COMMAND"
  fi
fi

exit 0
