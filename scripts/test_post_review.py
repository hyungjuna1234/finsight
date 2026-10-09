"""
post_review.py 테스트: PR diff에서 코멘트를 달 수 있는 줄 계산, 인라인·본문 나누기, gh api 호출과 422 재시도.
gh는 PATH 앞에 둔 가짜 gh로 바꿔서 GitHub에 실제로 게시하지 않는다.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import post_review as pr

SCRIPT = Path(__file__).parent / "post_review.py"

DIFF = """diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@ export
 line1
+added
 line2
 line3
@@ -20 +21 @@ fn
-old
+new
diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
--- a/src/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-x
-y
diff --git a/src/empty.ts b/src/empty.ts
--- a/src/empty.ts
+++ b/src/empty.ts
@@ -5,2 +4,0 @@
-p
-q
"""

FAKE_GH = """#!/bin/bash
# 호출마다 인자와 stdin을 번호 붙여 저장하고, FAKE_GH_EXITS(쉼표 목록)의 n번째 값으로 끝낸다.
n=$(( $(cat "$GH_DIR/count" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$GH_DIR/count"
printf '%s\\n' "$@" > "$GH_DIR/args.$n"
cat > "$GH_DIR/input.$n"
code=$(echo "${FAKE_GH_EXITS:-0}" | cut -d, -f"$n")
code=${code:-0}
[ "$code" != 0 ] && echo "gh: Validation Failed (HTTP 422)" >&2
exit "$code"
"""


def comment(path: str, line: int, severity: str = "major") -> dict:
    return {"path": path, "line": line, "severity": severity, "dimensions": ["security"], "body": f"[🟠 {severity}] {path}:{line} 문제\nTL;DR 깨진다.\n✓ Good 맞다.\n→ Fix `x()`"}


class TestCommentableLines:
    def test_collects_new_side_lines_of_every_hunk(self):
        lines = pr.commentable_lines(DIFF)
        assert lines["src/a.ts"] == {1, 2, 3, 4, 21}

    def test_ignores_deleted_files_and_empty_new_sides(self):
        lines = pr.commentable_lines(DIFF)
        assert "src/gone.ts" not in lines
        assert lines.get("src/empty.ts", set()) == set()


class TestSplit:
    def test_keeps_comments_on_diff_lines_inline_and_moves_the_rest(self):
        inline, outside = pr.split([comment("src/a.ts", 2), comment("src/a.ts", 15), comment("src/other.ts", 1)], {"src/a.ts": {1, 2, 3}})
        assert [(c["path"], c["line"]) for c in inline] == [("src/a.ts", 2)]
        assert [(c["path"], c["line"]) for c in outside] == [("src/a.ts", 15), ("src/other.ts", 1)]

    def test_body_holds_the_summary_and_comments_outside_the_diff(self):
        body = pr.body("## 판정: Approve\n", [comment("src/b.ts", 9)])
        assert body.startswith("## 판정: Approve")
        assert "`src/b.ts:9`" in body and "src/b.ts:9 문제" in body
        assert pr.MARKER in body


# ---------------------------------------------------------------------------
# 스크립트 실행 (임시 레포 + 가짜 gh)


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture
def posting(tmp_path):
    repo = tmp_path / "r"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "t@example.com")
    git(repo, "config", "user.name", "t")
    (repo / "a.txt").write_text("".join(f"line{i}\n" for i in range(1, 31)))
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "base")
    base = git(repo, "rev-parse", "HEAD")
    text = (repo / "a.txt").read_text().replace("line5\n", "changed5\n")
    (repo / "a.txt").write_text(text)
    git(repo, "commit", "-qam", "head")
    head = git(repo, "rev-parse", "HEAD")

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(FAKE_GH)
    gh.chmod(0o755)
    gh_dir = tmp_path / "gh"
    gh_dir.mkdir()
    env = {k: v for k, v in os.environ.items() if k != "FAKE_GH_EXITS"}
    env.update(PATH=f"{bin_dir}:{env['PATH']}", GH_DIR=str(gh_dir))

    review = {"summary_markdown": "## 판정: Changes Requested\n", "comments": [comment("a.txt", 5), comment("a.txt", 25, "minor")]}
    review_file = tmp_path / "review.json"
    review_file.write_text(json.dumps(review, ensure_ascii=False))

    def post(**extra_env):
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(review_file), "--repo", "o/r", "--pr", "7", "--base", base, "--commit", head],
            cwd=repo, env={**env, **extra_env}, capture_output=True, text=True, timeout=30,
        )

    def sent(n: int) -> dict:
        return json.loads((gh_dir / f"input.{n}").read_text())

    return post, sent, gh_dir, head


class TestScript:
    def test_posts_one_review_with_inline_comments_on_diff_lines(self, posting):
        post, sent, gh_dir, head = posting
        proc = post()
        assert proc.returncode == 0
        assert (gh_dir / "args.1").read_text().splitlines()[:2] == ["api", "repos/o/r/pulls/7/reviews"]
        payload = sent(1)
        assert payload["event"] == "COMMENT" and payload["commit_id"] == head
        assert payload["comments"] == [{"path": "a.txt", "line": 5, "side": "RIGHT", "body": comment("a.txt", 5)["body"]}]
        assert payload["body"].startswith("## 판정: Changes Requested") and "`a.txt:25`" in payload["body"]

    def test_moves_every_comment_into_the_body_when_github_rejects_them(self, posting):
        post, sent, _, _ = posting
        proc = post(FAKE_GH_EXITS="1,0")
        assert proc.returncode == 0
        retry = sent(2)
        assert retry["comments"] == []
        assert "`a.txt:5`" in retry["body"] and "`a.txt:25`" in retry["body"]

    def test_fails_when_the_review_cannot_be_posted(self, posting):
        post, _, _, _ = posting
        proc = post(FAKE_GH_EXITS="1,1")
        assert proc.returncode == 1
        assert "post_review" in proc.stderr
