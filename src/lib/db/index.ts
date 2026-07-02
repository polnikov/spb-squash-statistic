import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { PgDatabase } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://bbr:bbr@localhost:5432/bbr";

// Reuse the connection across hot reloads in development.
const globalForDb = globalThis as unknown as {
  __bbrSql?: ReturnType<typeof postgres>;
};

const client = globalForDb.__bbrSql ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__bbrSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };

/**
 * Accepts the base db or a transaction handle, so functions taking a
 * `Database` can be called inside `db.transaction(tx => ...)`.
 */
export type Database = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
