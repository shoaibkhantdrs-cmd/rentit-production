import { Pool } from "pg";
import { env } from "@/config/env";

// Single shared connection pool for the whole app.
// Import `pool` wherever a query needs to run:
//   import { pool } from "@/config/database";
//   await pool.query("SELECT 1");
//
// Bug fix: neither a connection-acquisition timeout nor a per-query
// statement timeout was ever set. node-postgres's default for
// `connectionTimeoutMillis` is 0, which means "wait forever" -- if the DB
// host is unreachable, DNS fails, the password/SSL requirement is wrong, or
// the platform blocks the port, `pool.query()` just hangs indefinitely with
// no error and no resolution. Every route that touches the DB (register,
// login -- even the "identifier not found" branch, since that still calls
// findByEmail/findByPhone -- and the DB-backed `/health` readiness check)
// would then hang until Render's own gateway timeout kills the connection,
// which surfaces to the client as a 503 with *zero* application-level
// logging, since the request never reaches pino-http's "request completed"
// line or errorHandler.ts's catch block -- the exact same failure shape as
// the SmtpClient bug fixed alongside this one. `statement_timeout` is a
// second, independent guard: it bounds an individual query that *did*
// connect but is stuck server-side (lock contention, a runaway query),
// which `connectionTimeoutMillis` alone would not catch.
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  // See env.ts's `databaseSsl` doc comment: `undefined` here (the default)
  // means "don't attempt SSL at all", which is exactly what this pool has
  // always done -- so this line is a no-op for the deployed app and every
  // existing environment unless DATABASE_SSL=true is set explicitly.
  // `rejectUnauthorized: false` is the standard tradeoff for managed
  // Postgres providers (Render, Heroku, Neon, Supabase, ...) whose server
  // certs typically aren't in Node's default trusted CA bundle -- the
  // connection is still fully encrypted, only certificate-chain
  // verification is relaxed.
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // Unexpected errors on idle clients — log and let the process supervisor
  // (docker/pm2/etc.) decide whether to restart.
  console.error("Unexpected PostgreSQL client error", err);
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Database connection check failed", err);
    return false;
  }
}
