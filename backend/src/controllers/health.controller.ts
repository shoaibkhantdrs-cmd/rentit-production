import { Request, Response } from "express";
import { checkDatabaseConnection } from "@/config/database";

export async function getHealth(_req: Request, res: Response) {
  const databaseConnected = await checkDatabaseConnection();

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Phase 6 Part 4 (observability): liveness vs readiness split, the
 * standard Kubernetes/orchestrator distinction. getHealth() above answers
 * "is this instance ready to serve traffic" (checks the DB, so a broken
 * DB connection correctly takes the instance out of a load balancer's
 * rotation). This answers only "is the Node process itself still running
 * and able to handle an HTTP request" -- no I/O, can't fail for any
 * reason short of the event loop being completely wedged. An
 * orchestrator should use this for restart decisions and the DB-backed
 * one for routing decisions: if the DB is briefly down you want the pod
 * marked not-ready (stop sending it traffic), NOT killed and restarted,
 * since restarting does nothing to fix the DB.
 */
export function getLiveness(_req: Request, res: Response) {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: Number(process.uptime().toFixed(3)),
    timestamp: new Date().toISOString(),
  });
}
