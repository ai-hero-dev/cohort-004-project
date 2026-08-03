# Database Conventions (SQLite + Drizzle)

Database is SQLite via `better-sqlite3` + Drizzle. The `db` instance is initialized once in `app/db/index.ts` with WAL mode and foreign keys enabled. Don't create new `Database` connections in service code unless you have a really good reason — import the shared instance instead.

## Primary keys

DB ids are always `integer().primaryKey({ autoIncrement: true })`. Don't use UUIDs.

## Timestamps

Timestamps are stored as ISO strings in `text` columns, not as unix timestamps or integers.

```ts
$defaultFn(() => new Date().toISOString())
```

## Booleans

Booleans are stored as integers with Drizzle's `mode: "boolean"`:

```ts
integer("ppp_enabled", { mode: "boolean" })
```

## Soft deletes

Use a nullable `text("deleted_at")` column. Don't actually delete rows. See `lessonComments` in the schema for an example.

## Price values

Prices are stored in cents (integers), not decimal amounts. For display conventions see [frontend.md](frontend.md#price-formatting).
