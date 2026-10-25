#!/bin/bash
# perf-loop measure: 더미 env로 PUB 프로덕션 빌드를 띄우고 8개 PUB 페이지에 npx lighthouse(performance만)를 돌린다.
# playwright.config.ts의 webServer 설정(더미 env, build+start)과 owasp-scan/scripts/probe.sh의 안전 점검을 그대로 따른다.
# 결과: $RUN_DIR/<slug>.json (route별 Lighthouse JSON 리포트, performance 카테고리만)
# 표준출력: 한 줄에 하나 `OK <route> <slug>` 또는 `ROUTE_FAIL <route> <slug>` — 마지막 줄 `SUMMARY <ok>/<total>`.
# exit 0 = 측정 진행됨(route별 실패가 있어도), 2 = 실행 못 함(포트 사용 중·다른 빌드·하네스·빌드 실패·서버 기동 실패).
# 사용: run-lighthouse.sh --run-dir <경로> [--port N]   (기본 포트 3101, e2e의 3100과 겹치지 않게 한다)

PORT=3101
RUN_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT=$2; shift 2 ;;
    --run-dir) RUN_DIR=$2; shift 2 ;;
    *) echo "run-lighthouse.sh: 알 수 없는 옵션 $1 (사용: run-lighthouse.sh --run-dir <경로> [--port N])" >&2; exit 64 ;;
  esac
done
if [ -z "$RUN_DIR" ]; then echo "run-lighthouse.sh: --run-dir 필요" >&2; exit 64; fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "SKIP git 레포가 아니다"; exit 2; }
cd "$ROOT" || exit 2
mkdir -p "$RUN_DIR"

# --- 실행 조건 (probe.sh와 동일) ---
if [ -e "$(git rev-parse --git-common-dir)/harness.lock" ]; then echo "SKIP 하네스 실행 중(harness.lock)"; exit 2; fi
if pgrep -f "next build" >/dev/null 2>&1; then echo "SKIP 다른 next build 실행 중"; exit 2; fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "SKIP 포트 $PORT 사용 중(--port로 바꾼다)"; exit 2; fi

# --- 더미 env: playwright.config.ts의 webServer와 동일한 값 ---
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="e2e-dummy-anon-key"

LOGDIR=$(mktemp -d)
START=$(date +%s)
if ! npm run build >"$LOGDIR/build.log" 2>&1; then
  echo "SKIP 빌드 실패 (마지막 20줄)"
  tail -n 20 "$LOGDIR/build.log"
  rm -rf "$LOGDIR"
  exit 2
fi
echo "BUILD ok ($(( $(date +%s) - START ))s)"

node node_modules/next/dist/bin/next start -p "$PORT" >"$LOGDIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; rm -rf "$LOGDIR"' EXIT

B="http://localhost:$PORT"
for _ in $(seq 1 60); do
  curl -s -o /dev/null "$B/" && break
  sleep 1
done
if ! curl -s -o /dev/null "$B/"; then echo "SKIP 서버 기동 실패"; tail -n 20 "$LOGDIR/server.log"; exit 2; fi
echo "SERVER $B"

# route -> 리포트 파일 slug (parse-report.mjs와 동일한 매핑을 쓴다)
ROUTES="/|index
/demo|demo
/pricing|pricing
/guide|guide
/refund|refund
/privacy|privacy
/terms|terms
/login|login"

OK=0
TOTAL=0
echo "$ROUTES" | while IFS='|' read -r route slug; do
  [ -z "$route" ] && continue
  TOTAL=$((TOTAL + 1))
  if npx --yes lighthouse "$B$route" \
    --only-categories=performance \
    --chrome-flags="--headless=new --no-sandbox" \
    --quiet --output=json --output-path="$RUN_DIR/$slug.json" \
    >"$LOGDIR/lh-$slug.log" 2>&1; then
    echo "OK $route $slug"
    OK=$((OK + 1))
  else
    echo "ROUTE_FAIL $route $slug (마지막 10줄)"
    tail -n 10 "$LOGDIR/lh-$slug.log"
  fi
  echo "$OK $TOTAL" > "$LOGDIR/counts"
done

read -r OK TOTAL < "$LOGDIR/counts" 2>/dev/null || { OK=0; TOTAL=8; }
echo "SUMMARY $OK/$TOTAL"
exit 0
