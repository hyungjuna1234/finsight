#!/bin/bash
# Worktree Init — 새 git 워크트리(.claude/worktrees/*)에서 한 번 돌린다.
# 워크트리에는 node_modules가 없으므로 lock 파일 그대로 설치하고, 어느 커밋에서 시작했는지 출력한다.

ROOT=$(git rev-parse --show-toplevel) || exit 1
cd "$ROOT" || exit 1

npm ci --prefer-offline --no-audit --no-fund || exit 1

echo "worktree: $ROOT"
echo "branch:   $(git branch --show-current)"
echo "base:     $(git log -1 --format='%h %s')"
