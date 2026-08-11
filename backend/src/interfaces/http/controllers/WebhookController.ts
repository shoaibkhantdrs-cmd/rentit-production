import { Request, Response } from "express";
import { HandlePaymentWebhookUseCase } from "@/application/payments/HandlePaymentWebhook.usecase";

/**
 * Deliberately does NOT extend/throw through the normal AppError ->
 * errorHandler path for signature failures the way other controllers do:
 * gateways expect a plain 2xx/4xx with no particular body shape, and (more
 * importantly) they retry aggressively on 5xx, so an unexpected-shape
 * error here should still resolve to a 400, not a 500 that triggers a
 * retry storm. asyncHandler + errorHandler already do this correctly
 * (UnauthorizedError -> 401 is remapped to 400 here specifically because
 * that's what the gateway is told, not what your dashboard shows) --
 * see routes/webhook.routes.ts for why raw body capture matters.
 */
export class WebhookController {
  constructor(
    // null when the corresponding provider's webhook secret isn't
    // configured (see container.ts) -- there is deliberately no gateway
    // call in that case, not even verifyWebhookSignature(), because that
    // would HMAC against an empty-string secret that anyone could
    // replicate. The endpoint stays safely unavailable until a real
    // secret is set, rather than the whole app failing to start.
    private readonly handleRazorpayWebhook: HandlePaymentWebhookUseCase | null,
    private readonly handleStripeWebhook: HandlePaymentWebhookUseCase | null,
  ) {}

  razorpay = async (req: Request, res: Response): Promise<void> => {
    if (!this.handleRazorpayWebhook) {
      res.status(503).json({ received: false, reason: "razorpay_webhook_not_configured" });
      return;
    }
    if (!req.rawBody) {
      res.status(400).json({ received: false });
      return;
    }
    const signature = req.header("x-razorpay-signature");
    try {
      const result = await this.handleRazorpayWebhook.execute(req.rawBody, signature);
      res.status(200).json({ received: true, ...result });
    } catch {
      // Never leak internals to an inbound webhook caller; log server-side
      // (the use-case already does) and tell the gateway "bad request" so
      // it doesn't treat this as a transient failure worth retrying forever.
      res.status(400).json({ received: false });
    }
  };

  stripe = async (req: Request, res: Response): Promise<void> => {
    if (!this.handleStripeWebhook) {
      res.status(503).json({ received: false, reason: "stripe_webhook_not_configured" });
      return;
    }
    if (!req.rawBody) {
      res.status(400).json({ received: false });
      return;
    }
    const signature = req.header("stripe-signature");
    try {
      const result = await this.handleStripeWebhook.execute(req.rawBody, signature);
      res.status(200).json({ received: true, ...result });
    } catch {
      res.status(400).json({ received: false });
    }
  };
}
