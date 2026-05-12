---
name: coding-standards
description: Project coding standards for this codebase. Use whenever writing or reviewing code in this repo, conducting a code review, or implementing any feature.
---

# Coding standards

Load the reference file(s) that match the area you're touching. For reviews or anything spanning the stack, load all five.

## References

- [typescript.md](typescript.md) — function signatures, `any`, import aliases
- [database.md](database.md) — schema conventions: ids, timestamps, booleans, soft deletes, prices, db instance
- [services-and-testing.md](services-and-testing.md) — service result pattern, vitest setup, db mocking
- [routes-and-forms.md](routes-and-forms.md) — React Router v7 routes, form validation, discriminated unions, auth
- [frontend-and-ui.md](frontend-and-ui.md) — `cn()`, shadcn layout, `formatPrice`

## When to use

- Before writing new code: load the reference matching the layer you're in.
- During review: load all references and check the diff against each.
- When the user asks about "coding standards", "conventions", "the rules", or how something should be done in this repo.
