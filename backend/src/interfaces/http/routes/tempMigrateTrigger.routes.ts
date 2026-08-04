import { timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { Router } from "express";

/**
 * TEMPORARY, ONE-TIME-USE route.
 *
 * Purpose: run `npm run migrate:up` (node-pg-migrate, applying
 * db/migrations/1700000000046_backfill-property-owner-role.js and any
 * other not-yet-applied migration) against the production database, from
 * inside the already-running production container. Render's free
 * instance type has no Shell or One-Off Jobs access (both are paid-plan
 * features), so -- same as the earlier one-off property-seeding route --
 * this is the only way to run a one-time command against prod without
 * upgrading the Render plan or handling the raw production DATABASE_URL
 * outside of Render's own environment.
 *
 * This shells out to the exact same `npm run migrate:up` a developer
 * would run locally, using the container's own already-configured env
 * vars (including DATABASE_URL) -- no credentials are read, logged, or
 * passed through this route.
 *
 * Protected by a hardcoded one-off bearer token. This is not a real
 * secret requiring rotation/storage -- this entire route is meant to be
 * deleted immediately after the single migration run it was added for.
 *
 * DO NOT leave this route deployed long-term. Remove this file and its
 * mount point in app.ts right after confirming the migration succeeded.
 */
const TEMP_MIGRATE_TOKEN = "434f362605cd8f5b09042911f6c441c1524c8144b021b114f79a708815e6a77c";

export const tempMigrateTriggerRouter = Router();

tempMigrateTriggerRouter.post("/", (req, res) => {
  const header = Buffer.from(req.header("x-migrate-token") ?? "");
  const expected = Buffer.from(TEMP_MIGRATE_TOKEN);
  if (header.length !== expected.length || !timingSafeEqual(header, expected)) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } });
    return;
  }

  execFile(
    "npm",
    ["run", "migrate:up"],
    { cwd: process.cwd(), timeout: 120000 },
    (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ ok: false, stdout, stderr, error: error.message });
        return;
      }
      res.status(200).json({ ok: true, stdout, stderr });
    },
  );
});
