import { timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { Router } from "express";

/**
 * TEMPORARY, ONE-TIME-USE route.
 *
 * Purpose: run the existing, completely unmodified
 * backend/scripts/seed-properties.ts against the production database, from
 * inside the already-running production container. Render's free instance
 * type has no Shell or One-Off Jobs access (both are paid-plan features),
 * so this is the only way to execute that script against prod without
 * upgrading the Render plan or handling the raw production DATABASE_URL
 * outside of Render's own environment.
 *
 * This file does NOT modify seed-properties.ts in any way. It shells out to
 * the exact same `npx tsx scripts/seed-properties.ts` command a developer
 * would run locally, using the container's own already-configured env vars
 * (including DATABASE_URL) -- no credentials are read, logged, or passed
 * through this route.
 *
 * Protected by a hardcoded one-off bearer token. This is not a real secret
 * requiring rotation/storage -- this entire route is meant to be deleted
 * immediately after the single seeding run it was added for.
 *
 * DO NOT leave this route deployed long-term. Remove this file and its
 * mount point in app.ts right after confirming the seed run succeeded.
 */
const TEMP_SEED_TOKEN = "5976c014c2597521232ec208b28e94cbd04d25984964c26c6978445fafc59f88";

export const tempSeedTriggerRouter = Router();

tempSeedTriggerRouter.post("/", (req, res) => {
  const header = Buffer.from(req.header("x-seed-token") ?? "");
  const expected = Buffer.from(TEMP_SEED_TOKEN);
  if (header.length !== expected.length || !timingSafeEqual(header, expected)) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } });
    return;
  }

  execFile(
    "npx",
    ["tsx", "scripts/seed-properties.ts"],
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
