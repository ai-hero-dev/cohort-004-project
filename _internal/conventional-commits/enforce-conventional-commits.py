#!/usr/bin/env python3
"""PreToolUse hook: block git commit commands whose message is not Conventional Commits format."""
import json
import re
import sys

CONVENTIONAL_RE = re.compile(
    r"^(feat|fix|chore|docs|refactor|test|style|perf|ci|build|revert)(\([^)]+\))?: .{1,72}$"
)

TYPES = "feat fix chore docs refactor test style perf ci build revert"


def extract_message(command: str) -> str | None:
    """Return the first line of the commit message, or None if we can't determine it."""
    # heredoc: git commit -m "$(cat <<'EOF'\n<message>\nEOF\n)"
    heredoc = re.search(r"<<['\"]?EOF['\"]?\s*\n(.*?)(?:\nEOF|\Z)", command, re.DOTALL)
    if heredoc:
        return heredoc.group(1).strip().splitlines()[0].strip()

    # inline -m "message" or -m 'message'
    inline = re.search(r'-m\s+["\']([^"\']+)["\']', command)
    if inline:
        return inline.group(1).strip().splitlines()[0].strip()

    return None


def main() -> None:
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")

    # Only care about git commit (not git commit --no-verify bypass attempts etc.)
    if "git commit" not in command:
        sys.exit(0)

    # --amend without -m keeps the existing message — allow through
    if "--amend" in command and "-m" not in command:
        sys.exit(0)

    msg = extract_message(command)

    if msg is None:
        # Can't parse message — allow through and let the commit-msg hook handle it
        sys.exit(0)

    if CONVENTIONAL_RE.match(msg):
        sys.exit(0)

    print(
        json.dumps({
            "decision": "block",
            "reason": (
                f"Commit message does not follow Conventional Commits format.\n"
                f"  Expected: type(scope): short summary  (max 72 chars)\n"
                f"  Types:    {TYPES}\n"
                f"  Got:      {msg}"
            ),
        })
    )
    sys.exit(0)  # decision=block in the JSON is what blocks it; exit code signals errors


if __name__ == "__main__":
    main()
