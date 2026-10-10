#!/bin/bash
# owasp-scan 빠른 도구: 의존성(A03)과 비밀키(A04) 검사. 섹션별로 stdout에 쓴다.
# 비밀 값은 출력하지 않는다(파일:줄·규칙 이름·커밋 해시만).
# 사용: deps.sh   (레포 루트 어디서든. 항상 exit 0, 실행 못 한 검사는 "실행 못 함"으로 적는다)

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "git 레포가 아니다"; exit 0; }
cd "$ROOT" || exit 0

audit() { # $1 = 이름, 나머지 = npm audit 인자
  local label=$1 out
  shift
  out=$(npm audit --json "$@" 2>/dev/null)
  if ! echo "$out" | jq -e '.metadata.vulnerabilities' >/dev/null 2>&1; then
    echo "## npm audit ($label): 실행 못 함 (네트워크 또는 lockfile 확인)"
    return
  fi
  echo "## npm audit ($label)"
  echo "$out" | jq -r '.metadata.vulnerabilities | "critical \(.critical) · high \(.high) · moderate \(.moderate) · low \(.low)"'
  echo "$out" | jq -r '
    .vulnerabilities[]
    | "- \(.name) [\(.severity)] direct=\(.isDirect) range=\(.range) fix=\(
        if .fixAvailable == true then "yes"
        elif .fixAvailable == false then "no"
        else "\(.fixAvailable.name)@\(.fixAvailable.version)\(if .fixAvailable.isSemVerMajor then " (major)" else "" end)" end
      ) :: \([.via[] | if type == "object" then "\(.title) \(.url)" else "via \(.)" end] | unique | join("; "))"'
}

audit "prod" --omit=dev
audit "전체"

echo "## 설치 스크립트가 있는 패키지"
if out=$(npm query ':is(:attr(scripts, [preinstall]), :attr(scripts, [install]), :attr(scripts, [postinstall]))' 2>/dev/null); then
  echo "$out" | jq -r 'if length == 0 then "없음" else .[] | "- \(.name)@\(.version)\(if .dev then " (dev)" else "" end)" end'
else
  echo "실행 못 함 (node_modules 필요)"
fi

echo "## 레지스트리 밖 패키지 (package-lock.json)"
if [ -f package-lock.json ]; then
  jq -r '
    [.packages | to_entries[]
     | select(.key != "" and .value.resolved != null and (.value.resolved | startswith("https://registry.npmjs.org/") | not))
     | "- \(.key) resolved=\(.value.resolved) integrity=\(if .value.integrity then "있음" else "없음" end)"]
    | if length == 0 then "없음" else .[] end' package-lock.json
else
  echo "package-lock.json 없음"
fi

echo "## 사전 배포·미고정 버전 (package.json)"
jq -r '
  [(.dependencies // {}), (.devDependencies // {}) | to_entries[]
   | select(.value | test("alpha|beta|rc|canary|next|latest|^\\*$"))
   | "- \(.key) \(.value)"]
  | if length == 0 then "없음" else .[] end' package.json

echo "## 추적되는 .env 파일"
TRACKED_ENV=$(git ls-files | grep -E '(^|/)\.env' | grep -vE '(^|/)\.env\.example$')
echo "${TRACKED_ENV:-없음}"

PATTERN='sk-ant-[A-Za-z0-9_-]{10,}|polar_(oat|pat|whs)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9+/=]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'

echo "## gitleaks"
if command -v gitleaks >/dev/null 2>&1; then
  REPORT=$(mktemp)
  if gitleaks git --help >/dev/null 2>&1; then
    gitleaks git --redact --no-banner --report-format json --report-path "$REPORT" >/dev/null 2>&1
  else
    gitleaks detect --redact --no-banner --report-format json --report-path "$REPORT" >/dev/null 2>&1
  fi
  if jq -e 'type == "array"' "$REPORT" >/dev/null 2>&1; then
    jq -r 'if length == 0 then "0건" else "\(length)건", (.[] | "- \(.File):\(.StartLine) rule=\(.RuleID) commit=\(.Commit[0:7])") end' "$REPORT"
  else
    echo "실행 못 함 (보고서 없음)"
  fi
  rm -f "$REPORT"
else
  echo "미설치 (brew install gitleaks) — 아래 정규식 대체 검사만 했다"
fi

echo "## 비밀키 정규식: 작업 트리, 커밋 안 된 새 파일 포함 (파일:줄만)"
HITS=$(git grep --untracked -nIE "$PATTERN" -- . ':!package-lock.json' 2>/dev/null | cut -d: -f1,2)
echo "${HITS:-없음}"

echo "## 비밀키 정규식: 커밋 이력 (해당 줄을 추가·삭제한 커밋)"
COMMITS=$(git log --all -G"$PATTERN" --format='- %h %ad %s' --date=short -- . ':!package-lock.json' 2>/dev/null)
echo "${COMMITS:-없음}"

exit 0
