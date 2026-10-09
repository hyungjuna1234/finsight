#!/usr/bin/env python3
"""
Review Code — /review-code를 헤드리스(claude -p)로 돌리고 판정한다. pre-push 훅과 GitHub Actions가 같이 쓴다.
모델은 scripts/review-schema.json 형식으로 코멘트와 요약 재료만 낸다. 판정·개수·요약 머리말은
이 스크립트가 docs/REVIEW_GUIDE.md 판정 표대로 계산한다(모델이 낸 판정이 개수와 어긋난 적이 있다).

사용: python3 scripts/review_code.py <범위> [--verify PASS|FAIL] [--json-out 파일] [--model M] [--effort E]
  --verify    CI의 verify job 결과를 넘긴다. 스킬은 verify.sh를 다시 돌리지 않는다.
  --json-out  판정·개수·요약·코멘트·쓴 모델·비용을 JSON으로 저장한다(PR 게시용).
  --model, --effort  기본은 DEFAULT_MODEL·DEFAULT_EFFORT(환경변수 REVIEW_CODE_MODEL·REVIEW_CODE_EFFORT로 바꿈).
              사용자 설정이 없는 CI에서도 로컬과 같은 모델로 돌게 고정한다.
exit 0 Approve·Changes Requested · 1 Blocked · 2 리뷰 실행 실패(claude 없음·인증·구조화 출력 없음·시간 초과)
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCHEMA = Path(__file__).resolve().parent / "review-schema.json"
SEVERITIES = ("critical", "major", "minor", "nit")
ICONS = {"critical": "🔴", "major": "🟠", "minor": "🟡", "nit": "⚪"}
DEFAULT_TIMEOUT_S = 30 * 60
# 로컬 헤드리스 시험(4분 51초, 약 $2.59)에서 쓴 설정. CI는 사용자 설정이 없어 고정하지 않으면 기본 모델로 돈다.
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_EFFORT = "xhigh"

# dontAsk 모드에서 이 목록 밖의 도구는 거부된다. 리뷰는 읽기 전용이라 git은 조회 명령만 허용한다.
ALLOWED_TOOLS = ",".join([
    "Read", "Grep", "Glob", "Agent",
    "Bash(bash scripts/review-range.sh *)", "Bash(bash scripts/verify.sh *)",
    "Bash(git diff *)", "Bash(git show *)", "Bash(git log *)",
    "Bash(git rev-parse *)", "Bash(git ls-files *)", "Bash(git status *)",
])

# 이 스크립트를 부른 Claude Code 세션의 변수. 지워서 터미널에서 직접 실행한 것과 같은 조건으로 돌린다.
SESSION_VARS = (
    "CLAUDECODE", "CLAUDE_CODE_SSE_PORT", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ATTENDED", "CLAUDE_PID", "CLAUDE_EFFORT",
)


class ReviewError(Exception):
    pass


def child_env(environ: dict) -> dict:
    env = {key: value for key, value in environ.items() if key not in SESSION_VARS}
    env["REVIEW_CODE_HEADLESS"] = "1"  # Stop 훅(stop-verify.sh)이 build를 다시 돌리지 않게 하는 표시
    env["CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"] = "1"  # 서브에이전트를 포그라운드로: 모두 보고한 뒤에 결과를 낸다
    return env


def build_command(range_: str, verify: str | None = None, model: str = DEFAULT_MODEL, effort: str = DEFAULT_EFFORT) -> list[str]:
    note = "이 실행은 scripts/review_code.py의 헤드리스 실행이다. SKILL.md의 '7. 헤드리스 실행'을 따른다."
    if verify:
        note += f" REVIEW_VERIFY={verify}"
    return [
        "claude", "-p", f"/review-code {range_}",
        "--output-format", "json",
        "--model", model,
        "--effort", effort,
        "--json-schema", SCHEMA.read_text(),
        "--permission-mode", "dontAsk",
        "--allowedTools", ALLOWED_TOOLS,
        "--append-system-prompt", note,
    ]


def tally(comments: list[dict]) -> dict:
    counts = dict.fromkeys(SEVERITIES, 0)
    for comment in comments:
        counts[comment["severity"]] += 1
    return counts


def decide(counts: dict, verify: str, failed_dimensions: list[str]) -> str:
    if counts["critical"] or verify == "FAIL":
        return "Blocked"
    if counts["major"] or failed_dimensions:
        return "Changes Requested"
    return "Approve"


def title(body: str) -> str:
    first = body.splitlines()[0] if body else ""
    return first.split("] ", 1)[1] if "] " in first else first


def rank(comment: dict) -> int:
    return SEVERITIES.index(comment["severity"])


def bare(item: str) -> str:
    # 모델이 붙여 보낸 번호·글머리표를 떼고 렌더러가 다시 붙인다.
    return re.sub(r"^\s*(?:\d+[.)]|[-*•])\s+", "", item)


def render_summary(review: dict, range_: str) -> str:
    counts = tally(review["comments"])
    verdict = decide(counts, review["verify"], review["failed_dimensions"])
    lines = [
        f"## 판정: {verdict}",
        f"범위 `{range_}` · 차원 {'·'.join(review['dimensions'])} · verify {review['verify']}",
        " · ".join(f"{ICONS[s]} {counts[s]}" for s in SEVERITIES),
    ]
    if review["failed_dimensions"]:
        lines.append(f"리뷰 못 함: {', '.join(review['failed_dimensions'])}")
    lines += ["", "**Walkthrough**", review["walkthrough"], "", "**잘된 점**"]
    lines += [f"- {bare(point)}" for point in review["good_points"]]
    lines += ["", "**Critical / Major**"]
    serious = sorted((c for c in review["comments"] if c["severity"] in ("critical", "major")), key=lambda c: (rank(c), c["path"], c["line"]))
    lines += [
        f"{i}. {ICONS[c['severity']]} `{c['path']}:{c['line']}` {title(c['body'])} ({'·'.join(c['dimensions'])})"
        for i, c in enumerate(serious, 1)
    ] or ["없음"]
    lines += ["", "**다음 액션**"]
    lines += [f"{i}. {bare(action)}" for i, action in enumerate(review["next_actions"], 1)]
    return "\n".join(lines) + "\n"


def render(review: dict, range_: str) -> str:
    text = render_summary(review, range_)
    comments = sorted(review["comments"], key=lambda c: (c["path"], rank(c), c["line"]))
    if comments:
        text += "\n---\n"
        for c in comments:
            text += f"\n{c['path']}:{c['line']}\n{c['body']}\n"
    return text


def run_claude(cmd: list[str], env: dict, timeout: int) -> dict:
    if shutil.which(cmd[0], path=env.get("PATH")) is None:
        raise ReviewError("claude CLI를 찾을 수 없습니다. 설치: https://code.claude.com/docs")
    try:
        # claude -p는 stdin을 읽는다. git 훅의 stdin(push할 ref 목록)을 넘기지 않는다.
        proc = subprocess.run(cmd, env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise ReviewError(f"리뷰 시간 초과({timeout}초)")
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise ReviewError(f"claude 출력이 JSON이 아닙니다(exit {proc.returncode}): {proc.stdout.strip()[:200]}")
    if proc.returncode != 0 or data.get("is_error") or not data.get("structured_output"):
        raise ReviewError(f"리뷰 실패(exit {proc.returncode}, {data.get('subtype')}): {str(data.get('result', ''))[:200]}")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/review-code를 헤드리스로 돌리고 판정한다.")
    parser.add_argument("range", help="리뷰할 git 범위(예: origin/main...HEAD)")
    parser.add_argument("--verify", choices=["PASS", "FAIL"], help="이미 돌린 verify.sh 결과")
    parser.add_argument("--json-out", help="결과 JSON을 저장할 파일")
    parser.add_argument("--model", default=os.environ.get("REVIEW_CODE_MODEL") or DEFAULT_MODEL)
    parser.add_argument("--effort", default=os.environ.get("REVIEW_CODE_EFFORT") or DEFAULT_EFFORT)
    args = parser.parse_args(argv)

    timeout = int(os.environ.get("REVIEW_CODE_TIMEOUT_S", DEFAULT_TIMEOUT_S))
    try:
        data = run_claude(build_command(args.range, args.verify, args.model, args.effort), child_env(dict(os.environ)), timeout)
    except ReviewError as error:
        print(f"review_code: {error}", file=sys.stderr)
        return 2

    review = data["structured_output"]
    if args.verify:
        review["verify"] = args.verify
    counts = tally(review["comments"])
    verdict = decide(counts, review["verify"], review["failed_dimensions"])
    print(render(review, args.range), end="")
    models = sorted(data.get("modelUsage") or {})
    cost = data.get("total_cost_usd", 0)
    print(f"review_code: 모델 {', '.join(models) or '알 수 없음'} · effort {args.effort} · 비용 약 ${cost:.2f}(정가 기준 추정)", file=sys.stderr)

    if args.json_out:
        # review를 먼저 펼친다. 모델이 덧붙인 키가 계산한 값을 덮어쓰지 못한다.
        Path(args.json_out).write_text(json.dumps({
            **review,
            "range": args.range,
            "verdict": verdict,
            "counts": counts,
            "summary_markdown": render_summary(review, args.range),
            "models": models,
            "cost_usd": cost,
        }, ensure_ascii=False, indent=2))
    return 1 if verdict == "Blocked" else 0


if __name__ == "__main__":
    sys.exit(main())
