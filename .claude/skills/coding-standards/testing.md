# Testing Conventions

## Service tests are required

Anything named as a "service" (e.g. `authTokenService.ts`) must have tests in an accompanying `.test.ts` file.

## Vitest db mocking pattern

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
