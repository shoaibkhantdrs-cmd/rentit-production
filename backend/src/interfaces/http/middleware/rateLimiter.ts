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

/**
 * Added during the production-readiness audit: a general-purpose limiter
 * for endpoints that trigger an outbound message (chat, WhatsApp) but
 * aren't shaped like the auth endpoints above (no email/identifier body
 * field to key on). Keys by the authenticated user id when available,
 * falling back to IP for the one unauthenticated endpoint that needs this
 * (WhatsApp share) -- so a signed-in abuser can't dodge the limit by
 * rotating IPs, and an anonymous one is still capped per-IP.
 */
export function createMessagingRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => req.user?.sub ?? `ip:${req.ip}`,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new TooManyRequestsError("Too many requests. Please slow down and try again shortly."));
    },
  });
}

/**
 * Phase 6 Part 1 (Payments): webhook endpoints have no authenticated user
 * to key on (the caller is Razorpay/Stripe, not one of our users) and
 * must stay reachable even under a burst of legitimate redeliveries --
 * this exists purely to bound the cost of an unexpected flood, not to
 * throttle normal traffic. A 429 here is safe: gateways treat it as a
 * transient failure and retry the same event later rather than dropping
 * it, so this can never silently lose a webhook.
 */
export function createWebhookRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => `ip:${req.ip}`,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new TooManyRequestsError("Too many webhook requests."));
    },
  });
}

/**
 * Phase 6 Part 2 (security audit fix): order-creation endpoints
 * (POST /payments/listing-boosts, POST /payments/subscriptions) had no
 * rate limiting at all -- each call creates a real order against a paid
 * external gateway API, so an authenticated user hammering these could
 * run up gateway-side request quotas/costs and litter the database with
 * abandoned pending listing_boosts/user_subscriptions rows. Keyed by user
 * id (these routes always require authenticate first) with a generous
 * default -- legitimate use is "a handful of purchases," not hundreds.
 */
export function createPaymentOrderRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => req.user?.sub ?? `ip:${req.ip}`,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new TooManyRequestsError("Too many payment attempts. Please wait a bit and try again."));
    },
  });
}
