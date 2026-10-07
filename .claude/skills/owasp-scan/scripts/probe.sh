#!/bin/bash
# owasp-scan probe: 더미 env로 프로덕션 빌드를 띄우고 HTTP로 실제 동작을 확인한다(A01·A02·A04·A07·A08·A10).
# 실제 Supabase·Polar·Anthropic에는 연결하지 않는다(Supabase URL은 닫힌 포트 127.0.0.1:9).
# 출력: 한 줄에 하나 `PASS|FAIL|WARN <ID> <카테고리> <심각도> <설명> — <관찰>`, 마지막 줄 `SUMMARY`.
# 심각도는 FAIL일 때 쓸 값이다(REVIEW_GUIDE: critical·major·minor·nit).
# exit 0 = 검사 완료(FAIL이 있어도), 2 = 실행 못 함(포트 사용 중·다른 빌드·하네스·빌드 실패·서버 기동 실패).
# 사용: probe.sh [--port N]   (기본 3199. e2e의 3100과 겹치지 않게 한다)
# 참고: 끝나면 .next에 더미 env 빌드가 남는다. 실제로 띄우려면 다시 빌드한다.

PORT=3199
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT=$2; shift 2 ;;
    *) echo "probe.sh: 알 수 없는 옵션 $1 (사용: probe.sh [--port N])" >&2; exit 64 ;;
  esac
done

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "SKIP git 레포가 아니다"; exit 2; }
cd "$ROOT" || exit 2

# --- 실행 조건 ---
if [ -e "$(git rev-parse --git-common-dir)/harness.lock" ]; then echo "SKIP 하네스 실행 중(harness.lock)"; exit 2; fi
if pgrep -f "next build" >/dev/null 2>&1; then echo "SKIP 다른 next build 실행 중"; exit 2; fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "SKIP 포트 $PORT 사용 중(--port로 바꾼다)"; exit 2; fi

# --- 더미 env: 서버 전용 값에는 고유 표식 SRV를 넣어 번들 유출을 찾는다 ---
MARK="owaspprobe$(date +%s)"
SRV="${MARK}srv"
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:9"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${MARK}-anon"
export SUPABASE_SERVICE_ROLE_KEY="${SRV}-service-role"
export ANTHROPIC_API_KEY="${SRV}-anthropic"
export POLAR_ACCESS_TOKEN="${SRV}-polar-token"
export POLAR_WEBHOOK_SECRET="${SRV}-polar-webhook"
export POLAR_SERVER=sandbox
export POLAR_PRO_PRODUCT_ID="${SRV}-product"
export CRON_SECRET="${SRV}-cron"

LOGDIR=$(mktemp -d)
START=$(date +%s)
if ! npm run build >"$LOGDIR/build.log" 2>&1; then
  echo "SKIP 빌드 실패 (마지막 20줄)"
  tail -n 20 "$LOGDIR/build.log"
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

PASS=0; FAIL=0; WARN=0
result() { # 상태 ID 카테고리 심각도 설명 관찰
  printf '%s %s %s %s %s — %s\n' "$1" "$2" "$3" "$4" "$5" "$6"
  case "$1" in PASS) PASS=$((PASS + 1)) ;; FAIL) FAIL=$((FAIL + 1)) ;; WARN) WARN=$((WARN + 1)) ;; esac
}
decode() { python3 -c 'import sys, urllib.parse as u; print(u.unquote(u.unquote(sys.argv[1])))' "$1"; }
LEAK_RE="node_modules|    at |ECONNREFUSED|127\\.0\\.0\\.1:9|fetch failed|PostgrestError|AuthRetryableFetchError|$MARK"
check_leak() { # ID 경로 본문파일
  if grep -qE "$LEAK_RE" "$3" 2>/dev/null; then
    result FAIL "$1" A10 minor "오류 응답에 내부 정보 노출 ($2)" "$(grep -oE "$LEAK_RE" "$3" | head -1)"
  fi
}

# 위조 세션 쿠키: 서명 없는 JWT와 가짜 user가 든 @supabase/ssr 형식. 서버가 getUser()로 검증하면 무시된다.
b64url() { printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '=\n'; }
FAKE_JWT="$(b64url '{"alg":"HS256","typ":"JWT"}').$(b64url '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aud":"authenticated","exp":4102444800}').x"
FAKE_SESSION="{\"access_token\":\"$FAKE_JWT\",\"refresh_token\":\"x\",\"expires_at\":4102444800,\"expires_in\":3600,\"token_type\":\"bearer\",\"user\":{\"id\":\"00000000-0000-4000-8000-000000000001\",\"aud\":\"authenticated\",\"role\":\"authenticated\"}}"
FAKE_COOKIE="sb-127-auth-token=base64-$(b64url "$FAKE_SESSION")"

# --- H: 보안 헤더 (A02·A04) ---
HDRS=$(curl -s -D - -o /dev/null "$B/" | tr -d '\r')
hdr() { echo "$HDRS" | grep -i "^$1:" | head -1 | cut -d: -f2- | sed 's/^ //'; }
CSP=$(hdr content-security-policy)
if [ -n "$CSP" ]; then result PASS H1 A02 major "CSP 있음" "있음"; else result FAIL H1 A02 major "CSP 헤더 없음" "/ 응답에 없음"; fi
if echo "$CSP" | grep -q "'unsafe-eval'"; then result FAIL H2 A02 major "프로덕션 CSP에 'unsafe-eval'" "script-src에 있음"; else result PASS H2 A02 major "프로덕션 CSP에 'unsafe-eval' 없음" "없음"; fi
MISSING=""
for d in "object-src 'none'" "base-uri 'self'" "frame-ancestors 'none'" "form-action 'self'"; do
  echo "$CSP" | grep -qF "$d" || MISSING="$MISSING [$d]"
done
if [ -z "$MISSING" ]; then result PASS H3 A02 minor "CSP 핵심 지시어" "모두 있음"; else result FAIL H3 A02 minor "CSP 지시어 누락" "$MISSING"; fi
HSTS=$(hdr strict-transport-security)
AGE=$(echo "$HSTS" | grep -oE 'max-age=[0-9]+' | cut -d= -f2)
if [ -n "$AGE" ] && [ "$AGE" -ge 31536000 ]; then result PASS H4 A04 minor "HSTS 1년 이상" "$HSTS"; else result FAIL H4 A04 minor "HSTS 없음 또는 1년 미만" "${HSTS:-없음}"; fi
if [ "$(hdr x-content-type-options)" = "nosniff" ]; then result PASS H5 A02 minor "X-Content-Type-Options nosniff" "nosniff"; else result FAIL H5 A02 minor "X-Content-Type-Options 없음" "$(hdr x-content-type-options)"; fi
if [ "$(hdr x-frame-options)" = "DENY" ] || echo "$CSP" | grep -qF "frame-ancestors 'none'"; then result PASS H6 A02 minor "클릭재킹 방어" "XFO=$(hdr x-frame-options)"; else result FAIL H6 A02 minor "클릭재킹 방어 없음" "XFO·frame-ancestors 없음"; fi
if [ -n "$(hdr referrer-policy)" ] && [ -n "$(hdr permissions-policy)" ]; then result PASS H7 A02 nit "Referrer·Permissions-Policy" "있음"; else result FAIL H7 A02 nit "Referrer-Policy 또는 Permissions-Policy 없음" "referrer=$(hdr referrer-policy) permissions=$(hdr permissions-policy)"; fi
if [ -z "$(hdr x-powered-by)" ]; then result PASS H8 A02 minor "X-Powered-By 없음" "없음"; else result FAIL H8 A02 minor "X-Powered-By 노출" "$(hdr x-powered-by)"; fi

# --- U·X: API 라우트 일괄 확인 (A01·A07). 인증 없음 → 401, 위조 쿠키 → 401, 다른 Origin → 403 ---
UUID=00000000-0000-4000-8000-000000000000
ROUTE_FILES=$(find src/app/api src/app/auth/signout -name route.ts 2>/dev/null | sort)
n=0
for f in $ROUTE_FILES; do
  rel=${f#src/app}; rel=${rel%/route.ts}
  case "$rel" in /api/webhooks/*|/api/cron/*) continue ;; esac
  path=$(echo "$rel" | sed -E "s/\\[[^]]+\\]/$UUID/g")
  for m in $(grep -oE 'export (const|async function) (GET|POST|PUT|PATCH|DELETE)\b' "$f" | awk '{print $3}'); do
    n=$((n + 1))
    BODY="$LOGDIR/body"
    s=$(curl -s -o "$BODY" -w '%{http_code}' -X "$m" -H "Origin: $B" -H 'content-type: application/json' -d '{}' "$B$path")
    if [ "$s" = 401 ]; then result PASS "U$n" A01 critical "$m $path 인증 없음 → 401" "$s"
    elif [ "${s:0:1}" = 2 ] || [ "${s:0:1}" = 3 ]; then result FAIL "U$n" A01 critical "$m $path 인증 없이 통과" "$s"
    else result FAIL "U$n" A01 major "$m $path 인증 없음인데 401이 아님(인증보다 다른 처리가 먼저)" "$s"; fi
    check_leak "U$n" "$m $path" "$BODY"

    s=$(curl -s -o "$BODY" -w '%{http_code}' -X "$m" -H "Origin: $B" -H "Cookie: $FAKE_COOKIE" -H 'content-type: application/json' -d '{}' "$B$path")
    if [ "$s" = 401 ]; then result PASS "F$n" A07 critical "$m $path 위조 세션 쿠키 → 401" "$s"
    else result FAIL "F$n" A07 critical "$m $path 위조 세션 쿠키를 거부하지 않음(getUser 검증 확인)" "$s"; fi
    check_leak "F$n" "$m $path" "$BODY"

    case "$m" in
      POST|PUT|PATCH|DELETE)
        s=$(curl -s -o /dev/null -w '%{http_code}' -X "$m" -H 'Origin: https://evil.example' -H 'content-type: application/json' -d '{}' "$B$path")
        if [ "$s" = 403 ]; then result PASS "X$n" A01 major "$m $path 다른 Origin → 403" "$s"
        else result FAIL "X$n" A01 major "$m $path 다른 Origin을 거부하지 않음(CSRF)" "$s"; fi
        ;;
    esac
  done
done
FIRST_POST=$(for f in $ROUTE_FILES; do grep -qE 'export (const|async function) POST\b' "$f" && echo "$f"; done | grep -vE 'webhooks|cron' | head -1)
if [ -n "$FIRST_POST" ]; then
  p=${FIRST_POST#src/app}; p=$(echo "${p%/route.ts}" | sed -E "s/\\[[^]]+\\]/$UUID/g")
  s=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Sec-Fetch-Site: cross-site' -H 'content-type: application/json' -d '{}' "$B$p")
  if [ "$s" = 403 ]; then result PASS X0 A01 major "Origin 없음 + Sec-Fetch-Site cross-site → 403 ($p)" "$s"; else result FAIL X0 A01 major "Origin 없는 cross-site 요청을 거부하지 않음 ($p)" "$s"; fi
fi

# --- C: cron 인증 (A07) ---
for case_ in "없음|" "틀린 값|Bearer wrong-$MARK" "빈 Bearer|Bearer "; do
  label=${case_%%|*}; auth=${case_#*|}
  if [ -n "$auth" ]; then s=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: $auth" "$B/api/cron/cleanup")
  else s=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/cron/cleanup"); fi
  if [ "$s" = 401 ]; then result PASS "C-$label" A07 critical "cron Authorization $label → 401" "$s"; else result FAIL "C-$label" A07 critical "cron Authorization $label 인데 401이 아님" "$s"; fi
done

# --- W: 웹훅 서명 (A08) ---
WBODY='{"type":"subscription.active","data":{"id":"x","customer":{"external_id":"00000000-0000-4000-8000-000000000001"}}}'
s=$(curl -s -o "$LOGDIR/body" -w '%{http_code}' -X POST -H 'content-type: application/json' -d "$WBODY" "$B/api/webhooks/polar")
if [ "$s" = 403 ]; then result PASS W1 A08 critical "웹훅 서명 없음 → 403" "$s"
elif [ "${s:0:1}" = 2 ]; then result FAIL W1 A08 critical "웹훅 서명 없이 처리됨" "$s"
else result FAIL W1 A08 major "웹훅 서명 없음인데 403이 아님" "$s"; fi
check_leak W1 "POST /api/webhooks/polar" "$LOGDIR/body"
s=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -H "webhook-id: msg_$MARK" -H "webhook-timestamp: $(date +%s)" -H 'webhook-signature: v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' -d "$WBODY" "$B/api/webhooks/polar")
if [ "$s" = 403 ]; then result PASS W2 A08 critical "웹훅 위조 서명 → 403" "$s"
elif [ "${s:0:1}" = 2 ]; then result FAIL W2 A08 critical "웹훅 위조 서명이 통과함" "$s"
else result FAIL W2 A08 major "웹훅 위조 서명인데 403이 아님" "$s"; fi

# --- P: 보호 페이지 (A01) ---
PREFIXES=$(sed -n '/PROTECTED_PREFIXES/,/\]/p' src/lib/domain/routes.ts | grep -oE '"/[^"]+"' | tr -d '"')
for p in $PREFIXES; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B$p")
  s=${out%% *}; loc=${out#* }
  if [ "${s:0:1}" = 3 ] && echo "$loc" | grep -q '/login'; then result PASS "P$p" A01 major "$p 비로그인 → 로그인으로" "$s"
  elif [ "$s" = 200 ]; then result FAIL "P$p" A01 major "$p 비로그인에 200 (내용 노출 확인 필요)" "$s"
  else result WARN "P$p" A01 major "$p 비로그인 응답이 로그인 리다이렉트가 아님" "$s $loc"; fi
done
out=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Cookie: $FAKE_COOKIE" "$B/dashboard")
s=${out%% *}
if [ "${s:0:1}" = 3 ]; then result PASS P-forged A07 major "/dashboard 위조 세션 쿠키 → 리다이렉트" "$s"; else result WARN P-forged A07 major "/dashboard 위조 세션 쿠키에 리다이렉트하지 않음" "$s"; fi

# --- R: 오픈 리다이렉트 (A01 CWE-601) ---
i=0
for payload in 'https://evil.example' '//evil.example' '/\evil.example' '%2F%2Fevil.example' 'javascript:alert(1)'; do
  for base in "/auth/login?provider=google&next=" "/auth/callback?code=x&next="; do
    i=$((i + 1))
    loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$B$base$payload")
    dec=$(decode "$loc")
    if echo "$dec" | grep -qiE 'evil\.example|javascript:'; then result FAIL "R$i" A01 major "오픈 리다이렉트 ${base%%\?*} next=$payload" "$loc"
    else result PASS "R$i" A01 major "리다이렉트 안전 ${base%%\?*} next=$payload" "${loc:0:80}"; fi
  done
done
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$B/auth/login?provider=evil")
if echo "$loc" | grep -q 'provider=evil'; then result FAIL R-provider A07 minor "허용 목록 밖 provider로 OAuth 시작" "$loc"; else result PASS R-provider A07 minor "허용 목록 밖 provider 거부" "${loc:0:80}"; fi

# --- K: 쿠키 속성 (A07) — /auth/login이 세우는 PKCE 쿠키 ---
SETC=$(curl -s -D - -o /dev/null "$B/auth/login?provider=google" | tr -d '\r' | grep -i '^set-cookie:' | head -1)
if [ -z "$SETC" ]; then result WARN K1 A07 major "PKCE 쿠키를 받지 못함(쿠키 속성 확인 못 함)" "Set-Cookie 없음"
else
  MISS=""
  echo "$SETC" | grep -qi 'httponly' || MISS="$MISS HttpOnly"
  echo "$SETC" | grep -qi 'secure' || MISS="$MISS Secure"
  echo "$SETC" | grep -qi 'samesite=lax\|samesite=strict' || MISS="$MISS SameSite"
  if [ -z "$MISS" ]; then result PASS K1 A07 major "인증 쿠키 HttpOnly·Secure·SameSite" "있음"; else result FAIL K1 A07 major "인증 쿠키 속성 누락" "$MISS"; fi
fi

# --- E·S: 오류 페이지와 정적 파일 노출 (A02·A10) ---
s=$(curl -s -o "$LOGDIR/body" -w '%{http_code}' "$B/owasp-probe-missing-$MARK")
if [ "$s" = 404 ]; then result PASS E1 A10 minor "없는 경로 → 404" "$s"; else result WARN E1 A10 minor "없는 경로가 404가 아님" "$s"; fi
check_leak E1 "없는 경로" "$LOGDIR/body"
for p in /.env /.env.local /.git/config /package.json /next.config.ts /tsconfig.json; do
  s=$(curl -s -o /dev/null -w '%{http_code}' "$B$p")
  if [ "$s" = 200 ]; then result FAIL "S$p" A02 major "$p 파일이 공개됨" "$s"; else result PASS "S$p" A02 major "$p 비공개" "$s"; fi
done

# --- B: 빌드 산출물 (A02·A04) ---
MAPS=$(find .next/static -name '*.map' 2>/dev/null | wc -l | tr -d ' ')
if [ "$MAPS" = 0 ]; then result PASS B1 A02 minor "브라우저 소스맵 없음" "0개"; else result FAIL B1 A02 minor "브라우저 소스맵 공개" "${MAPS}개"; fi
HIT=$(grep -rlF "$SRV" .next/static 2>/dev/null | head -3 | tr '\n' ' ')
if [ -z "$HIT" ]; then result PASS B2 A04 critical "클라이언트 번들에 서버 비밀값 없음" "없음"; else result FAIL B2 A04 critical "클라이언트 번들에 서버 비밀값" "$HIT"; fi
HIT=$(grep -rlF "$SRV" .next/server/app --include='*.html' --include='*.rsc' --include='*.body' --include='*.meta' 2>/dev/null | head -3 | tr '\n' ' ')
if [ -z "$HIT" ]; then result PASS B3 A04 critical "미리 렌더링한 페이지에 서버 비밀값 없음" "없음"; else result FAIL B3 A04 critical "미리 렌더링한 페이지에 서버 비밀값" "$HIT"; fi
HIT=$(grep -rlF "$SRV" .next/server --include='*.js' 2>/dev/null | head -3 | tr '\n' ' ')
if [ -z "$HIT" ]; then result PASS B4 A02 minor "서버 번들에 비밀값이 빌드 시 박히지 않음" "없음"; else result WARN B4 A02 minor "서버 번들에 비밀값이 빌드 시 박힘" "$HIT"; fi
for p in / /pricing /login; do
  curl -s -o "$LOGDIR/body" "$B$p"
  if grep -qF "$SRV" "$LOGDIR/body"; then result FAIL "B$p" A04 critical "$p HTML에 서버 비밀값" "있음"; fi
done

echo "SUMMARY PASS $PASS · FAIL $FAIL · WARN $WARN"
exit 0
