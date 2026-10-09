"""
review_code.py 테스트: 판정 계산, 요약 렌더링, claude 호출 인자와 환경, exit 코드.
claude는 PATH 앞에 둔 가짜 claude로 바꿔서 실제 리뷰를 돌리지 않는다.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import review_code as rc

SCRIPT = Path(__file__).parent / "review_code.py"

FAKE_CLAUDE = """#!/bin/bash
# 받은 인자와 환경을 기록하고, FAKE_CLAUDE_OUT을 stdout으로 내고 FAKE_CLAUDE_EXIT로 끝낸다.
printf '%s\\n' "$@" > "$FAKE_CLAUDE_ARGS"
env > "$FAKE_CLAUDE_ENV"
[ -n "${FAKE_CLAUDE_STDIN:-}" ] && cat > "$FAKE_CLAUDE_STDIN"
[ -n "${FAKE_CLAUDE_SLEEP:-}" ] && sleep "$FAKE_CLAUDE_SLEEP"
cat "$FAKE_CLAUDE_OUT"
exit "${FAKE_CLAUDE_EXIT:-0}"
"""


def comment(severity: str, path: str = "src/a.ts", line: int = 1, title: str = "문제", dims=("security",)) -> dict:
    icon = rc.ICONS[severity]
    body = f"[{icon} {severity}] {title}\nTL;DR 깨진다.\n✓ Good 맞다.\n→ Fix `x()`"
    return {"path": path, "line": line, "severity": severity, "dimensions": list(dims), "body": body}


def review(comments=(), verify="PASS", failed=()) -> dict:
    return {
        "dimensions": ["security", "privacy", "tests"],
        "verify": verify,
        "failed_dimensions": list(failed),
        "walkthrough": "두 버그를 고쳤다.",
        "good_points": ["`src/a.ts:3` 규칙을 검사한다"],
        "next_actions": ["고친 뒤 /review-code 다시 실행"],
        "comments": list(comments),
    }


def result(structured=None, **extra) -> dict:
    data = {
        "type": "result", "subtype": "success", "is_error": False, "result": "", "total_cost_usd": 1.5,
        "modelUsage": {"claude-opus-5-5": {"costUSD": 1.4}, "claude-haiku-4-5": {"costUSD": 0.1}},
    }
    if structured is not None:
        data["structured_output"] = structured
    data.update(extra)
    return data


# ---------------------------------------------------------------------------
# 판정 (docs/REVIEW_GUIDE.md 판정 표)


class TestDecide:
    @pytest.mark.parametrize(
        "severities, verify, failed, expected",
        [
            (["critical"], "PASS", [], "Blocked"),
            ([], "FAIL", [], "Blocked"),
            (["major", "minor"], "PASS", [], "Changes Requested"),
            ([], "PASS", ["security"], "Changes Requested"),
            (["minor", "nit"], "PASS", [], "Approve"),
            ([], "SKIPPED", [], "Approve"),
        ],
    )
    def test_follows_the_verdict_table(self, severities, verify, failed, expected):
        counts = rc.tally([comment(s) for s in severities])
        assert rc.decide(counts, verify, failed) == expected

    def test_counts_every_severity(self):
        counts = rc.tally([comment("major"), comment("major"), comment("nit")])
        assert counts == {"critical": 0, "major": 2, "minor": 0, "nit": 1}


# ---------------------------------------------------------------------------
# 요약 렌더링


class TestRender:
    def test_header_uses_the_computed_verdict_and_counts(self):
        text = rc.render(review([comment("critical"), comment("minor")]), "a..b")
        lines = text.splitlines()
        assert lines[0] == "## 판정: Blocked"
        assert "범위 `a..b`" in lines[1] and "verify PASS" in lines[1] and "security·privacy·tests" in lines[1]
        assert lines[2] == "🔴 1 · 🟠 0 · 🟡 1 · ⚪ 0"

    def test_lists_only_critical_and_major_in_the_summary(self):
        text = rc.render(review([comment("major", "src/b.ts", 7, "상한 우회"), comment("minor", title="경계값 누락")]), "a..b")
        summary = text.split("\n---\n")[0]
        assert "1. 🟠 `src/b.ts:7` 상한 우회 (security)" in summary
        assert "경계값 누락" not in summary

    def test_says_none_when_there_is_no_critical_or_major(self):
        summary = rc.render(review([comment("nit")]), "a..b").split("\n---\n")[0]
        assert "**Critical / Major**\n없음" in summary

    def test_appends_every_inline_comment_with_its_location(self):
        text = rc.render(review([comment("minor", "src/c.ts", 12)]), "a..b")
        inline = text.split("\n---\n")[1]
        assert "src/c.ts:12\n[🟡 minor] 문제\nTL;DR" in inline

    def test_does_not_number_items_twice(self):
        data = {**review(), "good_points": ["- `a.ts:1` 좋다"], "next_actions": ["1. 고친다", "2) 다시 리뷰"]}
        text = rc.render(data, "a..b")
        assert "\n1. 고친다\n2. 다시 리뷰\n" in text
        assert "\n- `a.ts:1` 좋다\n" in text

    def test_marks_dimensions_that_could_not_be_reviewed(self):
        text = rc.render(review(failed=["privacy"]), "a..b")
        assert "## 판정: Changes Requested" in text
        assert "리뷰 못 함: privacy" in text


# ---------------------------------------------------------------------------
# claude 호출 인자와 환경


class TestCommand:
    def test_runs_the_skill_headless_with_the_schema(self):
        cmd = rc.build_command("a..b")
        assert cmd[:3] == ["claude", "-p", "/review-code a..b"]
        assert cmd[cmd.index("--json-schema") + 1] == rc.SCHEMA.read_text()
        assert cmd[cmd.index("--output-format") + 1] == "json"
        assert cmd[cmd.index("--permission-mode") + 1] == "dontAsk"

    def test_allows_only_scoped_bash(self):
        allowed = rc.build_command("a..b")[rc.build_command("a..b").index("--allowedTools") + 1].split(",")
        assert "Bash" not in allowed
        assert all(not tool.startswith("Bash(") or tool.endswith(" *)") for tool in allowed)
        assert "Bash(git push *)" not in allowed

    def test_pins_the_model_and_effort_so_local_and_ci_match(self):
        cmd = rc.build_command("a..b")
        assert cmd[cmd.index("--model") + 1] == rc.DEFAULT_MODEL
        assert cmd[cmd.index("--effort") + 1] == rc.DEFAULT_EFFORT
        other = rc.build_command("a..b", model="sonnet", effort="high")
        assert other[other.index("--model") + 1] == "sonnet"
        assert other[other.index("--effort") + 1] == "high"

    def test_passes_the_verify_result_only_when_given(self):
        without = rc.build_command("a..b")
        with_verify = rc.build_command("a..b", verify="FAIL")
        assert "REVIEW_VERIFY" not in without[without.index("--append-system-prompt") + 1]
        assert "REVIEW_VERIFY=FAIL" in with_verify[with_verify.index("--append-system-prompt") + 1]

    def test_child_env_drops_the_calling_session_and_forces_foreground(self):
        env = rc.child_env({"PATH": "/bin", "CLAUDECODE": "1", "CLAUDE_CODE_SESSION_ID": "s", "CLAUDE_CODE_OAUTH_TOKEN": "t", "ANTHROPIC_API_KEY": "k"})
        assert "CLAUDECODE" not in env and "CLAUDE_CODE_SESSION_ID" not in env
        assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "t" and env["ANTHROPIC_API_KEY"] == "k"
        assert env["REVIEW_CODE_HEADLESS"] == "1"
        assert env["CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"] == "1"


# ---------------------------------------------------------------------------
# 스크립트 실행 (가짜 claude)


@pytest.fixture
def fake(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    claude = bin_dir / "claude"
    claude.write_text(FAKE_CLAUDE)
    claude.chmod(0o755)
    out = tmp_path / "claude.out"
    env = {k: v for k, v in os.environ.items() if not k.startswith(("FAKE_CLAUDE", "REVIEW_CODE_"))}
    env.update(
        PATH=f"{bin_dir}:/usr/bin:/bin",
        FAKE_CLAUDE_OUT=str(out),
        FAKE_CLAUDE_ARGS=str(tmp_path / "args"),
        FAKE_CLAUDE_ENV=str(tmp_path / "env"),
        CLAUDECODE="1",
    )

    def respond(data, exit_code=0):
        out.write_text(data if isinstance(data, str) else json.dumps(data))
        env["FAKE_CLAUDE_EXIT"] = str(exit_code)

    return env, respond, tmp_path


def run(env, *args) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args], env=env, capture_output=True, text=True, timeout=30)


class TestScript:
    def test_exits_1_and_prints_the_review_when_blocked(self, fake):
        env, respond, _ = fake
        respond(result(review([comment("critical")])))
        proc = run(env, "a..b")
        assert proc.returncode == 1
        assert "## 판정: Blocked" in proc.stdout

    def test_exits_0_when_changes_are_requested(self, fake):
        env, respond, _ = fake
        respond(result(review([comment("major")])))
        proc = run(env, "a..b")
        assert proc.returncode == 0
        assert "## 판정: Changes Requested" in proc.stdout

    def test_exits_1_when_the_given_verify_failed(self, fake):
        env, respond, tmp = fake
        respond(result(review(verify="FAIL")))
        proc = run(env, "a..b", "--verify", "FAIL")
        assert proc.returncode == 1
        assert "REVIEW_VERIFY=FAIL" in (tmp / "args").read_text()

    def test_writes_the_computed_review_as_json(self, fake):
        env, respond, tmp = fake
        respond(result(review([comment("major"), comment("nit")])))
        out = tmp / "review.json"
        run(env, "a..b", "--json-out", str(out))
        data = json.loads(out.read_text())
        assert data["verdict"] == "Changes Requested"
        assert data["counts"] == {"critical": 0, "major": 1, "minor": 0, "nit": 1}
        assert data["range"] == "a..b"
        assert data["summary_markdown"].startswith("## 판정: Changes Requested")
        assert len(data["comments"]) == 2
        assert data["models"] == ["claude-haiku-4-5", "claude-opus-5-5"]
        assert data["cost_usd"] == 1.5

    def test_reports_the_models_it_used(self, fake):
        env, respond, _ = fake
        respond(result(review()))
        proc = run(env, "a..b")
        # claude-haiku-4-5는 요청하지 않은 모델이라, 요청값이 아니라 modelUsage를 찍는지 확인된다.
        assert "모델 claude-haiku-4-5, claude-opus-5-5 · effort xhigh" in proc.stderr
        assert "$1.50" in proc.stderr

    @pytest.mark.parametrize("usage", [None, {}])
    def test_reports_unknown_models_without_failing(self, fake, usage):
        env, respond, tmp = fake
        data = result(review(), modelUsage=usage)
        del data["total_cost_usd"]
        respond(data)
        out = tmp / "review.json"
        proc = run(env, "a..b", "--json-out", str(out))
        assert proc.returncode == 0
        assert "모델 알 수 없음" in proc.stderr
        saved = json.loads(out.read_text())
        assert saved["models"] == [] and saved["cost_usd"] == 0

    def test_pins_the_model_and_effort_when_nothing_overrides_them(self, fake):
        # pre-push와 review.yml은 플래그 없이 부른다. 실제 고정은 main()의 기본값이 맡는다.
        env, respond, tmp = fake
        respond(result(review()))
        run(env, "a..b")
        args = (tmp / "args").read_text().splitlines()
        assert args[args.index("--model") + 1] == rc.DEFAULT_MODEL
        assert args[args.index("--effort") + 1] == rc.DEFAULT_EFFORT

    def test_takes_the_model_and_effort_from_the_environment(self, fake):
        env, respond, tmp = fake
        respond(result(review()))
        run({**env, "REVIEW_CODE_MODEL": "sonnet", "REVIEW_CODE_EFFORT": "medium"}, "a..b")
        args = (tmp / "args").read_text().splitlines()
        assert args[args.index("--model") + 1] == "sonnet"
        assert args[args.index("--effort") + 1] == "medium"

    def test_flags_win_over_the_environment(self, fake):
        env, respond, tmp = fake
        respond(result(review()))
        run({**env, "REVIEW_CODE_MODEL": "sonnet", "REVIEW_CODE_EFFORT": "medium"}, "a..b", "--model", "haiku", "--effort", "low")
        args = (tmp / "args").read_text().splitlines()
        assert args[args.index("--model") + 1] == "haiku"
        assert args[args.index("--effort") + 1] == "low"

    def test_does_not_hand_its_stdin_to_claude(self, fake):
        env, respond, tmp = fake
        respond(result(review()))
        env["FAKE_CLAUDE_STDIN"] = str(tmp / "stdin")
        subprocess.run([sys.executable, str(SCRIPT), "a..b"], env=env, input="refs/heads/b 1 refs/heads/b 2\n", capture_output=True, text=True, timeout=30)
        assert (tmp / "stdin").read_text() == ""

    def test_runs_claude_outside_the_calling_session(self, fake):
        env, respond, tmp = fake
        respond(result(review()))
        run(env, "a..b")
        child = (tmp / "env").read_text().splitlines()
        assert "REVIEW_CODE_HEADLESS=1" in child
        assert not any(line.startswith("CLAUDECODE=") for line in child)

    @pytest.mark.parametrize(
        "data, exit_code",
        [
            (result(None), 0),
            (result(review(), is_error=True, subtype="error_during_execution"), 0),
            (result(review()), 1),
            ("Not logged in", 1),
        ],
    )
    def test_exits_2_when_the_review_itself_fails(self, fake, data, exit_code):
        env, respond, _ = fake
        respond(data, exit_code)
        proc = run(env, "a..b")
        assert proc.returncode == 2
        assert "review_code" in proc.stderr

    def test_exits_2_when_claude_is_not_installed(self, fake):
        env, _, _ = fake
        env["PATH"] = "/usr/bin:/bin"
        proc = run(env, "a..b")
        assert proc.returncode == 2
        assert "claude" in proc.stderr

    def test_exits_2_when_the_review_times_out(self, fake):
        env, respond, _ = fake
        respond(result(review()))
        env["FAKE_CLAUDE_SLEEP"] = "5"
        env["REVIEW_CODE_TIMEOUT_S"] = "1"
        proc = run(env, "a..b")
        assert proc.returncode == 2
        assert "시간" in proc.stderr
