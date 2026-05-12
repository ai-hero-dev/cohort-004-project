# Services & testing

## Services need tests

Anything named like a service (e.g. `authTokenService.ts`) must have an accompanying `.test.ts` file.

## Tagged result pattern

For discriminated results from services (not validation), use:

```ts
{ ok: true, ... } | { ok: false, error: string }
```

See `couponService` for a reference.

## Vitest setup

Tests use vitest with globals. Every test file mocks the db module **before** importing the service under test:

```ts
let testDb: ReturnType<typeof createTestDb>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));
```

In `beforeEach`, use `createTestDb()` and `seedBaseData()` from `~/test/setup`.

The `vi.mock` call must be placed before the import of the service under test.
