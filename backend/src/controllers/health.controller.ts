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
