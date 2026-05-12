# Database & schema

SQLite via better-sqlite3 + Drizzle. The db instance is initialized in `app/db/index.ts` with WAL mode and foreign keys enabled. Don't create new `Database` connections in service code unless you have a really good reason.

## IDs

Always `integer().primaryKey({ autoIncrement: true })`. No UUIDs.

## Timestamps

Stored as ISO strings in `text` columns — not unix timestamps, not integers.

```ts
createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
```

## Booleans

Integers with Drizzle's `mode: "boolean"`:

```ts
pppEnabled: integer("ppp_enabled", { mode: "boolean" }),
```

## Soft deletes

Use a nullable `text("deleted_at")` column. Don't actually delete rows. See `lessonComments` in the schema for a reference.

## Prices

Stored in cents as integers. Use `formatPrice()` from `~/lib/utils` to display — it handles the "Free" case for `0`/`null`.
