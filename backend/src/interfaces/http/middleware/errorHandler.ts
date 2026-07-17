import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@/domain/errors/AppError";
import { env } from "@/config/env";
import { logger } from "@/infrastructure/logging/logger";
import type { IErrorTracker } from "@/domain/services/IErrorTracker";

/**
 * Phase 6 Part 4 (observability): now a factory instead of a bare
 * function, so container.ts can inject the real errorTracker (Sentry or
 * NoOp depending on whether SENTRY_DSN is set) rather than this module
 * reaching for a singleton itself -- consistent with every other
 * middleware in this codebase that needs a container-built dependency
 * (see createAuthRateLimiter, authenticateFactory).
 *
 * Only AppError instances with statusCode >= 500 and truly unhandled
 * errors are sent to the error tracker -- 4xx AppErrors (validation
 * failures, not-found, forbidden, etc.) are expected application flow,
 * not incidents, and reporting every one of them would bury real signal
 * in noise.
 */
export function createErrorHandler(errorTracker: IErrorTracker) {
  return function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ err, requestId: req.id }, err.message);
        errorTracker.captureException(err, {
          requestId: req.id !== undefined ? String(req.id) : undefined,
          userId: req.user?.sub,
          route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
          method: req.method,
          statusCode: err.statusCode,
        });
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
    errorTracker.captureException(err, {
      requestId: req.id !== undefined ? String(req.id) : undefined,
      userId: req.user?.sub,
      route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
      method: req.method,
      statusCode: 500,
    });

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: env.isProduction ? "Something went wrong" : err.message,
      },
      requestId: req.id,
    });
  };
}
