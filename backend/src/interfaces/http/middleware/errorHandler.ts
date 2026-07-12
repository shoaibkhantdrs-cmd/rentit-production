import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@/domain/errors/AppError";
import { env } from "@/config/env";
import { logger } from "@/infrastructure/logging/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.id }, err.message);
    } else {
      logger.warn({ requestId: req.id, code: err.code }, err.message);
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId: req.id,
    });
    return;
  }

  // Defensive: validate() middleware always converts ZodError into
  // ValidationError before it reaches here, but a use-case could in theory
  // let one leak through directly.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: err.flatten() },
      requestId: req.id,
    });
    return;
  }

  logger.error({ err, requestId: req.id }, "Unhandled error");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: env.isProduction ? "Something went wrong" : err.message,
    },
    requestId: req.id,
  });
}
