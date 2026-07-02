import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://bbr:bbr@localhost:5432/bbr",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
