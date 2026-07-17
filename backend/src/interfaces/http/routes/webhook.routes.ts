import { RequestHandler, Router } from "express";
import { WebhookController } from "@/interfaces/http/controllers/WebhookController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";

/**
 * Unauthenticated by design (the gateway calling us can't present our
 * users' JWTs) -- signature verification IS the authentication for these
 * two routes. Rate-limited by IP rather than user (there's no user) to
 * bound the cost of a malicious/broken sender hammering the endpoint;
 * see createWebhookRateLimiter in middleware/rateLimiter.ts.
 */
export function createWebhookRouter(
  controller: WebhookController,
  webhookRateLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post("/razorpay", webhookRateLimiter, asyncHandler(controller.razorpay));
  router.post("/stripe", webhookRateLimiter, asyncHandler(controller.stripe));

  return router;
}
