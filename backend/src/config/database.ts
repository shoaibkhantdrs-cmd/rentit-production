import { Pool } from "pg";
import { env } from "@/config/env";

// Single shared connection pool for the whole app.
// Import `pool` wherever a query needs to run:
//   import { pool } from "@/config/database";
//   await pool.query("SELECT 1");
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
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
