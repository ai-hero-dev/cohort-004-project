# Always use Conventional Commits

## Add a global instruction in `CLAUDE.md`

```md
## Git commit format

Always use Conventional Commits on the first attempt — a PreToolUse hook enforces this globally, so a wrong format costs double tokens (fail + retry).

```
<type>(<scope>): <short summary>   ← max 72 chars, imperative, lowercase after colon, no period

[optional body — explain the why, wrap at 72 chars]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat` `fix` `chore` `docs` `refactor` `test` `style` `perf` `ci` `build` `revert`

Scope: affected area in parentheses when it adds clarity — omit if broad.

```

## Add `enforce-conventional-commits.py` in global hooks for protection

```bash
touch ~/.claude/hooks/enforce-conventional-commits.py
```

# Update Claude Code Settings

##  Open ~/.claude/settings.json

If this file doesn't exist yet, create it.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /Users/jkiesebrink/.claude/hooks/enforce-conventional-commits.py",
            "if": "Bash(git commit *)"
          }
        ]
      }
    ]
  }
}
```
