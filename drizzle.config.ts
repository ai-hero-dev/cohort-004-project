import { defineConfig } from "drizzle-kit";

// Run `pnpm db:generate` in a real terminal (needs TTY for interactive prompts).
// It produces BOTH a SQL file in drizzle/ AND a snapshot in drizzle/meta/ — commit both.
// Then apply with `pnpm db:migrate`.

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data.db",
  },
});
