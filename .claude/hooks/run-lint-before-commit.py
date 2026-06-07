#!/usr/bin/env python3
"""PreToolUse hook: run pnpm lint before any git commit."""
import json
import subprocess
import sys


def main() -> None:
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")

    if "git commit" not in command:
        sys.exit(0)

    result = subprocess.run(
        ["pnpm", "lint"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        sys.exit(0)

    print(
        json.dumps({
            "decision": "block",
            "reason": (
                "Linter errors found — fix them before committing.\n\n"
                + result.stdout
                + result.stderr
            ),
        })
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
