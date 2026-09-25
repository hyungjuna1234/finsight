#!/bin/bash
# TDD Guard Hook — PreToolUse[Edit|Write]
# 구현 코드를 작성하려 할 때, 같은 폴더에 테스트 파일(X.test.* / X.spec.*)이 먼저 있는지 확인한다.
# 테스트 없이 구현 코드를 작성하려 하면 차단한다. (테스트는 같은 폴더에 둔다 — CLAUDE.md 규칙)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# 파일 경로가 없으면 통과
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 프로젝트가 아직 스캐폴딩되지 않았으면(package.json 없음) TDD 가드를 건너뛴다.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ ! -f "$ROOT/package.json" ]; then
  exit 0
fi

BASE=$(basename "$FILE_PATH")

# 테스트 파일과 테스트 전용 위치는 허용
case "$BASE" in
  *.test.*|*.spec.*)
    exit 0
    ;;
esac
case "$FILE_PATH" in
  */e2e/*|*/supabase/tests/*|*/src/test/*|*/vitest.setup.*)
    exit 0
    ;;
esac

# .claude/ 인프라와 workflows/ 오케스트레이션 스크립트는 TDD 비대상
case "$FILE_PATH" in
  */.claude/*|*/workflows/*)
    exit 0
    ;;
esac

# 설정·타입·스타일·문서 파일은 테스트 불필요
case "$BASE" in
  *.json|*.css|*.scss|*.md|*.yml|*.yaml|*.sql|*.d.ts|.env*|*.config.*|tsconfig*)
    exit 0
    ;;
esac

# types/ 폴더는 테스트 불필요
case "$FILE_PATH" in
  */types/*|*/types.ts)
    exit 0
    ;;
esac

# Next.js 프레임워크 규약 파일은 허용 (로직은 server/·lib/에 두고 여기서는 조합만 한다)
case "$BASE" in
  layout.tsx|layout.ts|page.tsx|page.ts|loading.tsx|error.tsx|global-error.tsx|not-found.tsx|template.tsx|default.tsx|\
  robots.ts|sitemap.ts|manifest.ts|opengraph-image.tsx|icon.tsx|apple-icon.tsx|instrumentation.ts|proxy.ts|middleware.ts)
    exit 0
    ;;
esac

# 소스 파일이면 같은 폴더의 테스트 파일 존재 여부 확인
case "$BASE" in
  *.ts|*.tsx|*.js|*.jsx|*.mts|*.mjs)
    DIR=$(dirname "$FILE_PATH")
    STEM=$(echo "$BASE" | sed -E 's/\.(ts|tsx|js|jsx|mts|mjs)$//')

    for EXT in ts tsx js jsx mts; do
      if [ -f "${DIR}/${STEM}.test.${EXT}" ] || [ -f "${DIR}/${STEM}.spec.${EXT}" ]; then
        exit 0
      fi
    done

    cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "TDD GUARD: '${STEM}'의 테스트 파일이 같은 폴더에 없습니다. 구현 전에 ${DIR}/${STEM}.test.ts(x)를 먼저 작성하세요."
  }
}
EOF
    ;;
esac

exit 0
