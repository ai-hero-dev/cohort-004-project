---
name: coding-standards
description: This repo's coding conventions covering TypeScript style, database (Drizzle/SQLite) schema rules, backend routing/services/validation/auth patterns, frontend/UI conventions, and testing requirements. Use whenever writing, editing, or reviewing code in this repo, before implementing any feature or fix, when doing a code review, or when asked about coding standards/conventions.
---

# Coding Standards

This project's conventions, split by domain. Load only the reference file(s) relevant to the code you're touching — don't read all of them for a one-line change.

## Reference files

| File | Covers |
|---|---|
| [general.md](general.md) | Object params for same-type args, no `any`, `~/*` import alias — applies to all TS code |
| [database.md](database.md) | Drizzle/SQLite: primary keys, timestamps, booleans, soft deletes, connections, price storage |
| [backend.md](backend.md) | Route Router v7 routing, auth, form/param/body validation, multi-intent actions, service result pattern, service test requirement |
| [frontend.md](frontend.md) | `cn()`, shadcn/component file locations, price display formatting |
| [testing.md](testing.md) | Which files need tests, the vitest + db-mock pattern |

## When to use this skill

- **Implementing**: before writing route, service, schema, or component code, check the reference file(s) for that domain and follow them.
- **Reviewing**: when reviewing a diff/PR, check changed files against the applicable reference file(s) and flag violations explicitly.
- **Answering "what's our convention for X"**: look it up in the relevant file rather than guessing or inferring from a single example.

## Routing by file type

- Touching `app/db/schema.ts` or migrations → [database.md](database.md)
- Touching `app/routes/**` → [backend.md](backend.md) (+ [general.md](general.md))
- Touching `app/services/**` or `*Service.ts` → [backend.md](backend.md) + [testing.md](testing.md)
- Touching `app/components/**` → [frontend.md](frontend.md)
- Touching `*.test.ts` → [testing.md](testing.md)
- Anything else TypeScript → [general.md](general.md)
