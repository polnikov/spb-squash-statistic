import process from "node:process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[migrate] ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const mainClient = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 20,
  onnotice: logNotice,
});

const diagnosticClient = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 20,
});

const db = drizzle(mainClient, { logger: false });

const watchdog = setInterval(() => {
  console.error("[migrate] still running; printing database diagnostics");
  void printDiagnostics();
}, 30000);

try {
  await mainClient`set lock_timeout = '10s'`;
  await mainClient`set statement_timeout = '170s'`;

  await migrate(db, {
    migrationsFolder: "./drizzle",
    migrationsSchema: "drizzle",
    migrationsTable: "__drizzle_migrations",
  });

  console.log("[migrate] migrations up to date");
} catch (error) {
  console.error("[migrate] ERROR:", formatError(error));
  await printDiagnostics();
  process.exitCode = 1;
} finally {
  clearInterval(watchdog);
  await Promise.allSettled([
    mainClient.end({ timeout: 5 }),
    diagnosticClient.end({ timeout: 5 }),
  ]);
}

function logNotice(notice) {
  const code = notice.code ? ` ${notice.code}` : "";
  console.log(`[migrate:notice] ${notice.severity ?? "NOTICE"}${code}: ${notice.message}`);
}

function formatError(error) {
  if (!error || typeof error !== "object") return String(error);

  const parts = [
    error.name,
    error.code,
    error.message,
    error.detail && `detail=${error.detail}`,
    error.hint && `hint=${error.hint}`,
    error.table && `table=${error.table}`,
    error.column && `column=${error.column}`,
    error.constraint_name && `constraint=${error.constraint_name}`,
  ].filter(Boolean);

  return parts.join(" | ");
}

async function printDiagnostics() {
  try {
    const activity = await diagnosticClient`
      select
        pid,
        state,
        wait_event_type,
        wait_event,
        now() - query_start as query_age,
        left(query, 240) as query
      from pg_stat_activity
      where datname = current_database()
      order by query_start nulls last
      limit 20
    `;

    const locks = await diagnosticClient`
      select
        blocked.pid as blocked_pid,
        blocking.pid as blocking_pid,
        blocked_activity.wait_event_type,
        blocked_activity.wait_event,
        left(blocked_activity.query, 180) as blocked_query,
        left(blocking_activity.query, 180) as blocking_query
      from pg_locks blocked
      join pg_stat_activity blocked_activity on blocked_activity.pid = blocked.pid
      join pg_locks blocking
        on blocking.locktype = blocked.locktype
       and blocking.database is not distinct from blocked.database
       and blocking.relation is not distinct from blocked.relation
       and blocking.page is not distinct from blocked.page
       and blocking.tuple is not distinct from blocked.tuple
       and blocking.virtualxid is not distinct from blocked.virtualxid
       and blocking.transactionid is not distinct from blocked.transactionid
       and blocking.classid is not distinct from blocked.classid
       and blocking.objid is not distinct from blocked.objid
       and blocking.objsubid is not distinct from blocked.objsubid
       and blocking.pid <> blocked.pid
      join pg_stat_activity blocking_activity on blocking_activity.pid = blocking.pid
      where not blocked.granted
      order by blocked_activity.query_start nulls last
      limit 20
    `;

    const migrationState = await diagnosticClient`
      select id, hash, created_at
      from "drizzle"."__drizzle_migrations"
      order by created_at desc
      limit 8
    `.catch((error) => [{ error: formatError(error) }]);

    console.error("[migrate:diagnostics] activity=", JSON.stringify(activity, null, 2));
    console.error("[migrate:diagnostics] blocked_locks=", JSON.stringify(locks, null, 2));
    console.error("[migrate:diagnostics] migration_state=", JSON.stringify(migrationState, null, 2));
  } catch (error) {
    console.error("[migrate:diagnostics] ERROR:", formatError(error));
  }
}
