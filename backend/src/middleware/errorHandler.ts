import { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error(err);

  res.status(500).json({
    error: "Internal Server Error",
    message: env.isProduction ? undefined : err.message,
  });
}
