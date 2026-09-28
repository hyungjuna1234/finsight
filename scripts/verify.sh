#!/bin/bash
# Verify — 레포 루트에서 lint → test → build를 차례로 돌리고 단계마다 PASS/FAIL을 한 줄씩 출력한다.
# 첫 실패에서 멈추고 그 단계의 마지막 40줄을 보여 준 뒤 exit 1.
# Stop 훅(scripts/hooks/stop-verify.sh)·/review·사람이 같은 스크립트를 쓴다. 셸(zsh/bash)과 관계없이 결과가 같다.
#
# 사용: scripts/verify.sh [--clean]
#   --clean  끝난 뒤 .next(빌드 산출물)를 지운다. 워크트리에서 메인 루트 lint가 산출물을 검사하지 않게 할 때 쓴다.

CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    *) echo "verify.sh: 알 수 없는 옵션 $arg (사용: verify.sh [--clean])" >&2; exit 64 ;;
  esac
done

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT" || exit 1

LOG=$(mktemp)
STATUS=0
for STEP in lint test build; do
  if npm run "$STEP" >"$LOG" 2>&1; then
    echo "PASS $STEP"
  else
    echo "FAIL $STEP"
    tail -n 40 "$LOG"
    STATUS=1
    break
  fi
done
rm -f "$LOG"

[ "$CLEAN" = 1 ] && rm -rf "$ROOT/.next"
exit "$STATUS"
