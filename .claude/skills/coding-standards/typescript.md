# TypeScript conventions

## Object parameters for same-typed args

When a function has more than one parameter of the same type (e.g. multiple `string`s), use a single object parameter instead of positional parameters.

```ts
// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
```

## No `any`

Don't use `any`. If you're unsure of a type, check the Drizzle schema or use `typeof` inference.

## Import alias

Use the `~/*` alias for anything inside `/app`. No relative imports like `../../lib/utils` — use `~/lib/utils`.
