When you have a function with more than one parameter with the same type (i.e. `string`), use an object parameter instead of positional parameters:

```ts
// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
```

---

Anything marked as a 'service' (by the name of the file, for instance `authTokenService.ts`) should have tests written for them in an accompanying `.test.ts` file.

---

Use `~/*` import alias for anything inside `/app`. Don't use relative imports like `../../lib/utils`, use `~/lib/utils` instead.

---

DB ids are always `integer().primaryKey({ autoIncrement: true })`. Don't use UUIDs.

---

Timestamps in the database are stored as ISO strings in `text` columns, not as unix timestamps or integers. Use `$defaultFn(() => new Date().toISOString())` for defaults.

---

We use React Router v7 (file-based routing). Routes go in `app/routes/`. Each route file can export `loader`, `action`, `default` (component), `meta`, and `ErrorBoundary`. Don't put business logic directly in routes - call into services instead.

---

For form validation in route actions, use `parseFormData(formData, zodSchema)` from `~/lib/validation`. It returns `{ success, data, errors }`. For route params use `parseParams`. For JSON request bodies use `parseJsonBody`.

---

When a single route action needs to handle multiple different form submissions (like a page with both a "mark complete" button and a "delete comment" button), use Zod discriminated unions on an `intent` field:

```ts
const schema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("mark-complete") }),
  z.object({
    intent: z.literal("delete-comment"),
    commentId: z.coerce.number(),
  }),
]);
```

---

Auth is cookie-based via `~/lib/session`. Use `getCurrentUserId(request)` in loaders/actions. Returns `number | null`. Redirect to `/login` if null.

---

Booleans in SQLite are stored as integers with Drizzle's `mode: "boolean"`, e.g. `integer("ppp_enabled", { mode: "boolean" })`.

---

Tests use vitest with globals. Every test file needs to mock the db module like this:

```ts
let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));
```

The mock MUST come before importing the service under test. Use `createTestDb()` and `seedBaseData()` from `~/test/setup` in `beforeEach`.

---

Don't use `any`. If you need a type you're not sure about, check the Drizzle schema or use `typeof` inference.

---

For soft deletes, use a nullable `text("deleted_at")` column. Don't actually delete rows. See `lessonComments` in the schema for an example.

---

`cn()` from `~/lib/utils` for combining tailwind classes. It's clsx + tailwind-merge.

---

Shadcn components live in `app/components/ui/`. Custom components go directly in `app/components/`. Don't nest component folders deeper than that.

---

Price values are stored in cents (integers). Use `formatPrice()` from `~/lib/utils` to display them. It handles the "Free" case for 0/null.

---

When returning tagged/discriminated results from services (not validation), use `{ ok: true, ... } | { ok: false, error: string }` pattern. See couponService for reference.

---

Database is SQLite via better-sqlite3 + Drizzle. The db instance is initialized in `app/db/index.ts` with WAL mode and foreign keys enabled. Don't create new Database connections in service code unless you have a really good reason.
