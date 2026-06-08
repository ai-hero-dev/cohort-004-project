#!/usr/bin/env python3
"""PreToolUse hook: run lint-staged and typecheck before any git commit."""
import json
import subprocess
import sys


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def main() -> None:
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")

    if "git commit" not in command:
        sys.exit(0)

    lint = run(["pnpm", "exec", "lint-staged"])
    typecheck = run(["pnpm", "typecheck"])

    errors = []
    if lint.returncode != 0:
        errors.append("Lint errors:\n" + lint.stdout + lint.stderr)
    if typecheck.returncode != 0:
        errors.append("Type errors:\n" + typecheck.stdout + typecheck.stderr)

    if not errors:
        sys.exit(0)

    print(
        json.dumps({
            "decision": "block",
            "reason": "Fix errors before committing.\n\n" + "\n\n".join(errors),
        })
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
