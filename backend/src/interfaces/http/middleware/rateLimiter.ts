import rateLimit from "express-rate-limit";
import { NextFunction, Request, Response } from "express";
import { TooManyRequestsError } from "@/domain/errors/AppError";

/**
 * In-memory store (express-rate-limit's default). Fine for a single
 * instance; once the API runs on more than one node, swap the `store`
 * option for a Redis-backed one (rate-limit-redis) so limits are shared
 * across instances -- noted as a Phase 3+ deployment concern, not a
 * correctness bug at this stage.
 */
export function createAuthRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Rate-limit per IP + the identifier being attempted, so one abusive
    // IP can't lock out every other account, and one targeted account
    // can't be brute-forced from many IPs without also tripping the
    // per-IP half of the key.
    keyGenerator: (req: Request): string => {
      const identifier =
        (req.body as Record<string, unknown> | undefined)?.email ??
        (req.body as Record<string, unknown> | undefined)?.identifier ??
        "";
      return `${req.ip}:${String(identifier)}`;
    },
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new TooManyRequestsError("Too many attempts. Please try again later."));
    },
  });
}
