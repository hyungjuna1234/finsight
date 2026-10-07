#!/usr/bin/env python3
"""
Post Review — review_code.py --json-out 결과를 PR 리뷰 하나로 게시한다(GitHub Actions의 review job).
요약은 리뷰 본문에, 인라인 4줄 코멘트는 해당 줄에 단다. GitHub는 PR diff 밖 줄에 다는 코멘트가 하나라도 있으면
리뷰 전체를 거부(422)한다. 그래서 diff에서 코멘트를 달 수 있는 줄을 미리 계산해 그 밖의 코멘트는 본문으로 옮기고,
그래도 거부되면 모든 코멘트를 본문으로 옮겨 한 번 더 보낸다. 판정으로 job을 막는 일은 워크플로의 gate 단계가 한다.

사용: python3 scripts/post_review.py <review.json> --repo owner/name --pr N --base SHA --commit SHA
  gh CLI(GH_TOKEN)로 POST /repos/{repo}/pulls/{pr}/reviews 를 부른다. diff는 로컬 git으로 base...commit을 본다.
exit 0 게시함 · 1 게시 실패
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

MARKER = "<!-- review-code -->"
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def commentable_lines(diff: str) -> dict[str, set[int]]:
    lines: dict[str, set[int]] = {}
    path = None
    for row in diff.splitlines():
        if row.startswith("+++ "):
            target = row[4:]
            path = target[2:] if target.startswith("b/") else None  # +++ /dev/null: 지운 파일
            if path is not None:
                lines.setdefault(path, set())
            continue
        match = HUNK.match(row)
        if match and path is not None:
            start, count = int(match.group(1)), int(match.group(2) or 1)
            lines[path].update(range(start, start + count))
    return lines


def split(comments: list[dict], valid: dict[str, set[int]]) -> tuple[list[dict], list[dict]]:
    inline = [c for c in comments if c["line"] in valid.get(c["path"], set())]
    outside = [c for c in comments if c["line"] not in valid.get(c["path"], set())]
    return inline, outside


def body(summary: str, outside: list[dict]) -> str:
    text = summary.rstrip("\n") + "\n"
    if outside:
        text += "\n**diff 밖 코멘트**\n"
        for c in outside:
            text += f"\n`{c['path']}:{c['line']}`\n```text\n{c['body']}\n```\n"
    return text + f"\n{MARKER}\n"


def payload(commit: str, summary: str, inline: list[dict], outside: list[dict]) -> dict:
    return {
        "commit_id": commit,
        "event": "COMMENT",
        "body": body(summary, outside),
        "comments": [{"path": c["path"], "line": c["line"], "side": "RIGHT", "body": c["body"]} for c in inline],
    }


def send(repo: str, pr: str, data: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["gh", "api", f"repos/{repo}/pulls/{pr}/reviews", "--method", "POST", "--input", "-"],
        input=json.dumps(data, ensure_ascii=False), capture_output=True, text=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="review_code.py 결과를 PR 리뷰로 게시한다.")
    parser.add_argument("review", help="review_code.py --json-out 파일")
    parser.add_argument("--repo", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument("--base", required=True, help="PR base 커밋")
    parser.add_argument("--commit", required=True, help="PR head 커밋(리뷰한 커밋)")
    args = parser.parse_args(argv)

    review = json.loads(Path(args.review).read_text())
    diff = subprocess.run(["git", "diff", "--unified=3", f"{args.base}...{args.commit}"], capture_output=True, text=True, check=True).stdout
    inline, outside = split(review["comments"], commentable_lines(diff))

    first = send(args.repo, args.pr, payload(args.commit, review["summary_markdown"], inline, outside))
    if first.returncode == 0:
        return 0
    print(f"post_review: 리뷰가 거부돼서 코멘트를 모두 본문으로 옮겨 다시 보냅니다: {first.stderr.strip()[:200]}", file=sys.stderr)
    retry = send(args.repo, args.pr, payload(args.commit, review["summary_markdown"], [], review["comments"]))
    if retry.returncode == 0:
        return 0
    print(f"post_review: 리뷰를 게시하지 못했습니다: {retry.stderr.strip()[:200]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
