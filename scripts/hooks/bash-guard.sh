#!/bin/bash
# Bash Guard Hook — PreToolUse[Bash]
# 되돌릴 수 없는 명령과 운영 환경에 닿는 CLI를 차단한다.
# 운영 작업(supabase link/db push, vercel 배포, psql)은 사람이 finsight-ops/ clone에서 한다. (ops/README.md)
# 차단은 exit 2 + stderr (Claude Code는 exit 2만 차단으로 처리한다).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

block() {
  echo "BASH GUARD: $1 — 이 명령은 harness 작업 복사본에서 실행할 수 없습니다. 필요하면 사람이 finsight-ops/에서 실행합니다. (명령: $COMMAND)" >&2
  exit 2
}

# 명령 경계: 줄 시작, 공백, ; & | ( 뒤
B='(^|[;&|(`[:space:]])'

echo "$COMMAND" | grep -qE "${B}rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*(/|~|\\\$HOME|\\.\\.?/?([[:space:]]|$)|\\*|\\.git([[:space:]/]|$))" \
  && block "루트·홈·현재 폴더·.git 대상 rm -r"
echo "$COMMAND" | grep -qE "${B}git[[:space:]]+push([[:space:]].*)?[[:space:]](--force|-f)([[:space:]]|$|-)" \
  && block "git push --force"
echo "$COMMAND" | grep -qE "${B}git[[:space:]]+reset[[:space:]]+--hard" \
  && block "git reset --hard"
echo "$COMMAND" | grep -qiE "(DROP[[:space:]]+(TABLE|SCHEMA|DATABASE)|TRUNCATE[[:space:]]+)" \
  && block "파괴적 SQL"
echo "$COMMAND" | grep -qE "${B}(npx[[:space:]]+|pnpm[[:space:]]+dlx[[:space:]]+|bunx[[:space:]]+)?supabase([[:space:]]|$)" \
  && block "supabase CLI"
echo "$COMMAND" | grep -qE "${B}(npx[[:space:]]+|pnpm[[:space:]]+dlx[[:space:]]+|bunx[[:space:]]+)?vercel([[:space:]]|$)" \
  && block "vercel CLI"
echo "$COMMAND" | grep -qE "${B}psql([[:space:]]|$)" \
  && block "psql"

exit 0
