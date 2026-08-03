# General TypeScript Conventions

Applies to all TypeScript code in the repo, backend or frontend.

## Object params over positional params

When a function has more than one parameter of the same type (e.g. two `string`s), use a single object parameter instead of positional parameters.

```ts
// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
```

## No `any`

Don't use `any`. If you need a type you're not sure about, check the Drizzle schema or use `typeof` inference instead.

## Import alias

Use the `~/*` alias for anything inside `/app`. Don't use relative imports like `../../lib/utils` — use `~/lib/utils` instead.
