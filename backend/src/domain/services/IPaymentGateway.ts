/**
 * Port over a payment gateway (Razorpay or Stripe -- Phase 6 Part 1).
 * Both real implementations talk to the provider's REST API directly via
 * `fetch`, the same pattern already used for WhatsApp/Twilio/FCM in this
 * codebase, rather than pulling in a gateway SDK as a new dependency.
 *
 * Amounts are always the smallest currency unit (paise for INR, cents for
 * USD) end-to-end, matching how both providers' APIs already work -- no
 * conversion happens at this boundary.
 */
export interface CreateGatewayOrderInput {
  amount: number;
  currency: string;
  receipt: string; // our payment_order id, echoed back so webhooks can be matched without a lookup
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  gatewayOrderId: string;
  amount: number;
  currency: string;
  /**
   * Provider-specific extras the frontend SDK needs to actually collect
   * payment (Stripe's client_secret for confirmCardPayment; Razorpay
   * needs nothing extra beyond the order id + the public key it already
   * has from env). Deliberately untyped here -- callers know which
   * gateway they asked for and read the field they expect.
   */
  providerData?: Record<string, unknown>;
}

export interface GatewayRefund {
  gatewayRefundId: string;
  amount: number;
  status: "pending" | "processed" | "failed";
}

/** Normalized shape both gateways' webhook payloads are parsed into. */
export interface ParsedWebhookEvent {
  eventId: string;
  eventType:
    | "payment.succeeded"
    | "payment.failed"
    | "refund.processed"
    | "refund.failed"
    | "unhandled";
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  gatewayRefundId: string | null;
  amount: number | null;
  currency: string | null;
  method: string | null;
  raw: unknown;
}

export interface IPaymentGateway {
  readonly name: "razorpay" | "stripe";

  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;

  /**
   * Verifies the webhook's signature against the raw request body.
   * MUST be called with the exact bytes the gateway signed -- never a
   * re-serialized/parsed version of the body (see webhook.routes.ts for
   * why app.ts captures req.rawBody before JSON parsing).
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent;

  createRefund(gatewayPaymentId: string, amount: number, reason?: string): Promise<GatewayRefund>;
}
