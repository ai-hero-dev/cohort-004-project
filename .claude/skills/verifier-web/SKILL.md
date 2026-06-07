---
name: verifier-web
description: Web app verification handle for the Cadence project. Use when verifying UI changes, routes, or features in this React Router app. Provides dev server startup, Playwright browser driving via MCP, and seeded test user switching via the in-app DevUI.
---

# Verifier: Web (Cadence)

## Quick start

```bash
pnpm dev &> /tmp/dev-server.log &
# wait for ready
sleep 6 && grep "Local:" /tmp/dev-server.log
# → http://localhost:5177/
```

Then drive the app using Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_take_screenshot`, etc.).

## Switching users

The app has a **DevUI panel** in the bottom-right corner of every page (visible when logged in). Click "Switch user" to become any seeded user instantly — no login flow needed.

| User | Role |
|---|---|
| Alex Rivera | Admin |
| Sarah Chen | Instructor (has course + revenue data) |
| Marcus Johnson | Instructor |
| Emma Wilson | Student |
| James Park | Student |
| Olivia Martinez | Student |
| Liam Thompson | Student |
| Sophia Davis | Student |
| Bossy McBossface | Student |

## Cleanup

```bash
kill $(lsof -ti:5177) 2>/dev/null
```

Remove any screenshots saved during verification before committing.
