# Backend Conventions (Routes & Services)

## Routing

We use React Router v7 (file-based routing). Routes go in `app/routes/`. Each route file can export `loader`, `action`, `default` (component), `meta`, and `ErrorBoundary`. Don't put business logic directly in routes — call into services instead.

## Auth

Auth is cookie-based via `~/lib/session`. Use `getCurrentUserId(request)` in loaders/actions. Returns `number | null`. Redirect to `/login` if null.

## Form/param/body validation

For form validation in route actions, use `parseFormData(formData, zodSchema)` from `~/lib/validation`. It returns `{ success, data, errors }`. For route params use `parseParams`. For JSON request bodies use `parseJsonBody`.

## Multi-intent actions

When a single route action needs to handle multiple different form submissions (e.g. a page with both a "mark complete" button and a "delete comment" button), use a Zod discriminated union on an `intent` field:

```ts
const schema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("mark-complete") }),
  z.object({
    intent: z.literal("delete-comment"),
    commentId: z.coerce.number(),
  }),
]);
```

## Service result pattern

When returning tagged/discriminated results from services (not validation), use the `{ ok: true, ... } | { ok: false, error: string }` pattern. See `couponService` for reference.

## Service tests are required

Anything named as a "service" (e.g. `authTokenService.ts`) must have tests in an accompanying `.test.ts` file. See [testing.md](testing.md) for the required mocking pattern.
