"""
셸 스크립트 테스트: verify.sh · worktree-init.sh · review-range.sh · hooks/stop-verify.sh.
npm은 PATH 앞에 둔 가짜 npm으로 바꿔서 실제 lint/test/build를 돌리지 않는다.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parent
VERIFY = SCRIPTS / "verify.sh"
WORKTREE_INIT = SCRIPTS / "worktree-init.sh"
REVIEW_RANGE = SCRIPTS / "review-range.sh"
STOP_VERIFY = SCRIPTS / "hooks" / "stop-verify.sh"
PRE_PUSH = SCRIPTS.parent / ".githooks" / "pre-push"

FAKE_NPM = """#!/bin/bash
# 호출을 기록하고, NPM_FAIL(쉼표 목록)에 있는 스크립트는 실패시킨다.
step="$2"
[ "$1" = "ci" ] && step=ci
echo "$PWD|$*" >> "$NPM_LOG"
case ",${NPM_FAIL:-}," in
  *",$step,"*) echo "boom $step"; exit 1 ;;
esac
echo "ok $step"
"""


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def make_repo(path: Path, *, package_json: bool = True) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.email", "t@example.com")
    git(path, "config", "user.name", "t")
    (path / ".gitignore").write_text(".next/\nnode_modules/\n")
    if package_json:
        (path / "package.json").write_text("{}\n")
    (path / "a.txt").write_text("a\n")
    git(path, "add", "-A")
    git(path, "commit", "-q", "-m", "init")
    return path


def commit(repo: Path, message: str, name: str | None = None) -> str:
    (repo / (name or f"{len(list(repo.iterdir()))}.txt")).write_text(message + "\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def env(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    npm = bin_dir / "npm"
    npm.write_text(FAKE_NPM)
    npm.chmod(0o755)
    log = tmp_path / "npm.log"
    log.write_text("")
    e = {k: v for k, v in os.environ.items() if k not in ("CLAUDE_PROJECT_DIR", "NPM_FAIL", "GIT_DIR", "GIT_INDEX_FILE", "REVIEW_CODE_HEADLESS", "SKIP_REVIEW")}
    e["PATH"] = f"{bin_dir}:{e['PATH']}"
    e["NPM_LOG"] = str(log)
    return e


def npm_calls(env) -> list[str]:
    return [line for line in Path(env["NPM_LOG"]).read_text().splitlines() if line]


def run(script: Path, *args: str, cwd: Path, env, stdin: str = "") -> subprocess.CompletedProcess:
    return subprocess.run(["bash", str(script), *args], cwd=cwd, env=env, input=stdin, capture_output=True, text=True)


# ---------------------------------------------------------------------------
# verify.sh
# ---------------------------------------------------------------------------

class TestVerify:
    def test_runs_lint_test_build_in_order(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(VERIFY, cwd=repo, env=env)
        assert r.returncode == 0
        assert [c.split("|")[1] for c in npm_calls(env)] == ["run lint", "run test", "run build"]
        assert [line for line in r.stdout.splitlines() if line.startswith(("PASS", "FAIL"))] == ["PASS lint", "PASS test", "PASS build"]

    def test_stops_at_first_failure_and_shows_its_output(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(VERIFY, cwd=repo, env={**env, "NPM_FAIL": "test"})
        assert r.returncode == 1
        assert "PASS lint" in r.stdout and "FAIL test" in r.stdout
        assert "boom test" in r.stdout
        assert "run build" not in "\n".join(npm_calls(env))

    def test_runs_at_repo_root_from_a_subdirectory(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / "sub").mkdir()
        run(VERIFY, cwd=repo / "sub", env=env)
        assert {c.split("|")[0] for c in npm_calls(env)} == {str(repo.resolve())}

    def test_clean_removes_build_output_even_after_failure(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / ".next").mkdir()
        r = run(VERIFY, "--clean", cwd=repo, env={**env, "NPM_FAIL": "build"})
        assert r.returncode == 1
        assert not (repo / ".next").exists()

    def test_keeps_build_output_without_clean(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / ".next").mkdir()
        run(VERIFY, cwd=repo, env=env)
        assert (repo / ".next").exists()

    def test_rejects_unknown_option(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(VERIFY, "--nope", cwd=repo, env=env)
        assert r.returncode != 0
        assert npm_calls(env) == []


# ---------------------------------------------------------------------------
# worktree-init.sh
# ---------------------------------------------------------------------------

class TestWorktreeInit:
    def test_installs_dependencies_at_root_and_prints_base_commit(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / "sub").mkdir()
        r = run(WORKTREE_INIT, cwd=repo / "sub", env=env)
        assert r.returncode == 0
        assert npm_calls(env) == [f"{repo.resolve()}|ci --prefer-offline --no-audit --no-fund"]
        assert git(repo, "rev-parse", "--short", "HEAD") in r.stdout
        assert "init" in r.stdout

    def test_fails_when_install_fails(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(WORKTREE_INIT, cwd=repo, env={**env, "NPM_FAIL": "ci"})
        assert r.returncode != 0


# ---------------------------------------------------------------------------
# review-range.sh
# ---------------------------------------------------------------------------

def write_review(repo: Path, name: str, base: str, head: str):
    (repo / "docs" / "reviews").mkdir(parents=True, exist_ok=True)
    (repo / "docs" / "reviews" / name).write_text(f"# 리뷰\n\n범위: `{base}..{head}`\n")


def write_phases(repo: Path, phases: list[tuple[str, str]]):
    (repo / "phases").mkdir(exist_ok=True)
    (repo / "phases" / "index.json").write_text(json.dumps({"phases": [{"dir": d, "status": s} for d, s in phases]}))


class TestReviewRange:
    def test_uses_explicit_range(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        head = commit(repo, "feat: x")
        r = run(REVIEW_RANGE, f"{head}~1..{head}", cwd=repo, env=env)
        assert r.returncode == 0
        assert r.stdout.strip() == f"{head}~1..{head}"

    def test_rejects_unknown_explicit_range(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(REVIEW_RANGE, "nope..HEAD", cwd=repo, env=env)
        assert r.returncode == 2
        assert r.stdout == ""

    def test_reviews_uncommitted_changes_first(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / "new.txt").write_text("n\n")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.returncode == 0
        assert r.stdout.strip() == "HEAD"

    def test_reviews_branch_commits_against_main(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        git(repo, "checkout", "-q", "-b", "topic")
        commit(repo, "feat: topic")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.stdout.strip() == "main...HEAD"

    def test_continues_from_the_latest_recorded_review(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        first = commit(repo, "feat: one")
        second = commit(repo, "feat: two")
        commit(repo, "feat: three")
        write_review(repo, "2026-01-01-one.md", "aaaaaaa", first[:7])
        write_review(repo, "2026-01-02-two.md", first[:7], second[:7])
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "docs: reviews")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.returncode == 0
        assert r.stdout.strip() == f"{second[:7]}..HEAD"

    def test_reports_nothing_new_when_only_review_records_changed(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        head = git(repo, "rev-parse", "--short", "HEAD")
        write_review(repo, "r.md", "aaaaaaa", head)
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "docs: review record")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.returncode == 3
        assert r.stdout == ""

    def test_falls_back_to_the_last_completed_phase(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        write_phases(repo, [("1-a", "completed"), ("2-b", "completed"), ("3-c", "pending")])
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "chore(harness): add phases")
        before = git(repo, "rev-parse", "HEAD")
        commit(repo, "feat(2-b): step 0 — x")
        last = commit(repo, "chore(2-b): mark phase completed")
        commit(repo, "docs: later")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.returncode == 0
        assert r.stdout.strip() == f"{before[:7]}..{last[:7]}"

    def test_exits_3_when_nothing_to_review(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(REVIEW_RANGE, cwd=repo, env=env)
        assert r.returncode == 3
        assert r.stdout == ""


# ---------------------------------------------------------------------------
# hooks/stop-verify.sh
# ---------------------------------------------------------------------------

def stop_input(cwd: Path, active: bool = False) -> str:
    return json.dumps({"cwd": str(cwd), "stop_hook_active": active, "hook_event_name": "Stop"})


class TestStopVerify:
    def test_passes_immediately_when_already_bounced(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo, active=True))
        assert r.returncode == 0
        assert npm_calls(env) == []

    def test_passes_without_package_json(self, tmp_path, env):
        repo = make_repo(tmp_path / "r", package_json=False)
        r = run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        assert r.returncode == 0
        assert npm_calls(env) == []

    def test_verifies_the_session_cwd_not_the_project_dir(self, tmp_path, env):
        main = make_repo(tmp_path / "main")
        worktree = make_repo(tmp_path / "wt")
        (worktree / "src").mkdir()
        r = run(STOP_VERIFY, cwd=main, env={**env, "CLAUDE_PROJECT_DIR": str(main)}, stdin=stop_input(worktree / "src"))
        assert r.returncode == 0
        assert {c.split("|")[0] for c in npm_calls(env)} == {str(worktree.resolve())}

    def test_falls_back_to_project_dir_without_cwd(self, tmp_path, env):
        main = make_repo(tmp_path / "main")
        r = run(STOP_VERIFY, cwd=tmp_path, env={**env, "CLAUDE_PROJECT_DIR": str(main)}, stdin="{}")
        assert r.returncode == 0
        assert {c.split("|")[0] for c in npm_calls(env)} == {str(main.resolve())}

    def test_bounces_with_failed_step_and_tree(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        r = run(STOP_VERIFY, cwd=repo, env={**env, "NPM_FAIL": "test"}, stdin=stop_input(repo))
        assert r.returncode == 2
        first = r.stderr.splitlines()[0]
        assert "test" in first and str(repo.resolve()) in first
        assert "boom test" in r.stderr

    def test_skips_when_tree_unchanged_since_last_pass(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / "wip.txt").write_text("uncommitted\n")
        assert run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo)).returncode == 0
        assert run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo)).returncode == 0
        assert len(npm_calls(env)) == 3

    @pytest.mark.parametrize("change", ["tracked", "untracked"])
    def test_reverifies_after_a_change(self, tmp_path, env, change):
        repo = make_repo(tmp_path / "r")
        run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        (repo / ("a.txt" if change == "tracked" else "b.txt")).write_text("changed\n")
        run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        assert len(npm_calls(env)) == 6

    def test_does_not_remember_a_failure(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        assert run(STOP_VERIFY, cwd=repo, env={**env, "NPM_FAIL": "lint"}, stdin=stop_input(repo)).returncode == 2
        assert run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo)).returncode == 0
        assert len(npm_calls(env)) == 4

    def test_ignores_build_output_when_hashing(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        (repo / ".next").mkdir()
        (repo / ".next" / "x").write_text("x\n")
        run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        assert len(npm_calls(env)) == 3

    def test_skips_inside_a_headless_review(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / "wip.txt").write_text("uncommitted\n")
        r = run(STOP_VERIFY, cwd=repo, env={**env, "REVIEW_CODE_HEADLESS": "1"}, stdin=stop_input(repo))
        assert r.returncode == 0
        assert npm_calls(env) == []

    def test_defers_to_a_running_harness(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / ".git" / "harness.lock").write_text(str(os.getpid()))
        r = run(STOP_VERIFY, "--defer-to-harness", cwd=repo, env=env, stdin=stop_input(repo))
        assert r.returncode == 0
        assert npm_calls(env) == []

    def test_ignores_a_stale_harness_lock(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        dead = subprocess.Popen(["true"])
        dead.wait()
        (repo / ".git" / "harness.lock").write_text(str(dead.pid))
        run(STOP_VERIFY, "--defer-to-harness", cwd=repo, env=env, stdin=stop_input(repo))
        assert len(npm_calls(env)) == 3

    def test_verifies_despite_lock_without_defer_flag(self, tmp_path, env):
        repo = make_repo(tmp_path / "r")
        (repo / ".git" / "harness.lock").write_text(str(os.getpid()))
        run(STOP_VERIFY, cwd=repo, env=env, stdin=stop_input(repo))
        assert len(npm_calls(env)) == 3


# ---------------------------------------------------------------------------
# .githooks/pre-push

ZERO = "0" * 40

# 레포의 scripts/review_code.py 자리에 두는 가짜 실행기. 받은 범위를 기록하고 stdin을 다 읽은 뒤 RUNNER_EXIT로 끝낸다.
FAKE_RUNNER = """import os, sys
with open(os.environ["RUNNER_LOG"], "a") as log:
    log.write(" ".join(sys.argv[1:]) + "\\n")
sys.stdin.read()
sys.exit(int(os.environ.get("RUNNER_EXIT", "0")))
"""


@pytest.fixture
def pushing(tmp_path, env):
    repo = make_repo(tmp_path / "r")
    base = git(repo, "rev-parse", "HEAD")
    git(repo, "update-ref", "refs/remotes/origin/main", base)
    (repo / "scripts").mkdir()
    (repo / "scripts" / "review_code.py").write_text(FAKE_RUNNER)
    log = tmp_path / "runner.log"
    log.write_text("")
    return repo, base, {**env, "RUNNER_LOG": str(log)}, log


def ref_line(local: str, remote: str, ref: str = "refs/heads/feat") -> str:
    return f"{ref} {local} {ref} {remote}\n"


def short(repo: Path, sha: str) -> str:
    return git(repo, "rev-parse", "--short", sha)


def reviewed(log: Path) -> list[str]:
    return [line for line in log.read_text().splitlines() if line]


class TestPrePush:
    def test_reviews_the_commits_being_pushed(self, pushing):
        repo, base, env, log = pushing
        head = commit(repo, "change")
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=ref_line(head, base))
        assert r.returncode == 0
        assert reviewed(log) == [f"{short(repo, base)}..{short(repo, head)}"]

    def test_reviews_a_new_branch_against_the_remote_main(self, pushing):
        repo, _, env, log = pushing
        head = commit(repo, "change")
        run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=ref_line(head, ZERO))
        assert reviewed(log) == [f"origin/main...{short(repo, head)}"]

    def test_falls_back_to_the_remote_main_when_the_remote_tip_is_unknown(self, pushing):
        repo, _, env, log = pushing
        head = commit(repo, "change")
        run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=ref_line(head, "f" * 40))
        assert reviewed(log) == [f"origin/main...{short(repo, head)}"]

    def test_blocks_the_push_when_the_verdict_is_blocked(self, pushing):
        repo, base, env, _ = pushing
        head = commit(repo, "change")
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env={**env, "RUNNER_EXIT": "1"}, stdin=ref_line(head, base))
        assert r.returncode == 1
        assert "Blocked" in r.stderr and "SKIP_REVIEW=1" in r.stderr

    def test_lets_the_push_through_when_the_review_cannot_run(self, pushing):
        repo, base, env, _ = pushing
        head = commit(repo, "change")
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env={**env, "RUNNER_EXIT": "2"}, stdin=ref_line(head, base))
        assert r.returncode == 0
        assert "계속" in r.stderr

    def test_reviews_every_pushed_ref_even_if_the_runner_reads_stdin(self, pushing):
        repo, base, env, log = pushing
        head = commit(repo, "change")
        stdin = ref_line(head, base, "refs/heads/a") + ref_line(head, base, "refs/heads/b")
        run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=stdin)
        assert len(reviewed(log)) == 2

    @pytest.mark.parametrize("case", ["deleted", "nothing_new"])
    def test_skips_refs_without_new_commits(self, pushing, case):
        repo, base, env, log = pushing
        line = ref_line(ZERO, base) if case == "deleted" else ref_line(base, base)
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=line)
        assert r.returncode == 0
        assert reviewed(log) == []

    def test_skips_when_asked(self, pushing):
        repo, base, env, log = pushing
        head = commit(repo, "change")
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env={**env, "SKIP_REVIEW": "1"}, stdin=ref_line(head, base))
        assert r.returncode == 0
        assert reviewed(log) == []

    def test_skips_while_the_harness_runs(self, pushing):
        repo, base, env, log = pushing
        head = commit(repo, "change")
        (repo / ".git" / "harness.lock").write_text(str(os.getpid()))
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=ref_line(head, base))
        assert r.returncode == 0
        assert reviewed(log) == []

    def test_skips_a_new_branch_when_the_remote_main_is_unknown(self, pushing):
        repo, _, env, log = pushing
        git(repo, "update-ref", "-d", "refs/remotes/origin/main")
        head = commit(repo, "change")
        r = run(PRE_PUSH, "origin", "url", cwd=repo, env=env, stdin=ref_line(head, ZERO))
        assert r.returncode == 0
        assert reviewed(log) == []
