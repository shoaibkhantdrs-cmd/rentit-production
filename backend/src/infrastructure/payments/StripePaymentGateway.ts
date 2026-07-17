import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateGatewayOrderInput,
  GatewayOrder,
  GatewayRefund,
  IPaymentGateway,
  ParsedWebhookEvent,
} from "@/domain/services/IPaymentGateway";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  /** Max age of a webhook's `t=` timestamp before it's rejected as a replay. */
  webhookToleranceSeconds?: number;
}

interface StripePaymentIntentResponse {
  id: string;
  amount: number;
  currency: string;
  client_secret: string;
}

interface StripeRefundResponse {
  id: string;
  amount: number;
  status: string; // "pending" | "succeeded" | "failed"
}

/**
 * Real Stripe integration via `fetch` against Stripe's REST API
 * (https://api.stripe.com/v1) -- no `stripe` npm SDK dependency. Stripe's
 * API takes application/x-www-form-urlencoded bodies (including for
 * nested objects, via bracket notation), not JSON -- easy to get wrong if
 * porting from SDK-based examples, so buildFormBody() below is the one
 * place that matters.
 *
 * We model "order" as a PaymentIntent (Stripe has no direct equivalent of
 * Razorpay's Order object for a plain one-off charge); the frontend uses
 * the returned client_secret with Stripe.js to collect card details and
 * confirm the payment.
 */
export class StripePaymentGateway implements IPaymentGateway {
  readonly name = "stripe" as const;

  constructor(private readonly config: StripeConfig) {}

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    const body = buildFormBody({
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      "metadata[receipt]": input.receipt,
      ...Object.fromEntries(
        Object.entries(input.notes ?? {}).map(([k, v]) => [`metadata[${k}]`, v]),
      ),
    });

    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Stripe payment intent creation failed with HTTP ${response.status}: ${detail}`);
    }

    const intent = (await response.json()) as StripePaymentIntentResponse;
    return {
      gatewayOrderId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      providerData: { clientSecret: intent.client_secret },
    };
  }

  /**
   * Stripe-Signature header format: "t=<unix_ts>,v1=<hex_hmac>[,v0=...]".
   * The signed payload is the literal string "<t>.<rawBody>", HMAC-SHA256
   * with the webhook secret. See
   * https://docs.stripe.com/webhooks#verify-manually.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [k, v] = part.split("=");
        return [k, v];
      }),
    );
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    const tolerance = this.config.webhookToleranceSeconds ?? 300;
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (!Number.isFinite(age) || age > tolerance || age < -tolerance) return false;

    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = createHmac("sha256", this.config.webhookSecret).update(signedPayload).digest("hex");

    const providedBuf = Buffer.from(v1, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
  }

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    const body = JSON.parse(rawBody.toString("utf8")) as {
      id: string;
      type: string;
      data: {
        object: {
          id: string;
          amount?: number;
          amount_received?: number;
          currency?: string;
          payment_intent?: string;
          payment_method_types?: string[];
        };
      };
    };

    const obj = body.data.object;

    // Verify these three event names against the Stripe API version
    // configured on the account before going live -- Stripe occasionally
    // renames/splits refund-related events across API versions.
    let eventType: ParsedWebhookEvent["eventType"] = "unhandled";
    let gatewayPaymentId: string | null = null;
    let gatewayRefundId: string | null = null;

    if (body.type === "payment_intent.succeeded") {
      eventType = "payment.succeeded";
      gatewayPaymentId = obj.id;
    } else if (body.type === "payment_intent.payment_failed") {
      eventType = "payment.failed";
      gatewayPaymentId = obj.id;
    } else if (body.type === "charge.refunded") {
      eventType = "refund.processed";
      gatewayPaymentId = obj.payment_intent ?? null;
      gatewayRefundId = obj.id;
    }

    return {
      eventId: body.id,
      eventType,
      gatewayOrderId: body.type.startsWith("payment_intent.") ? obj.id : null,
      gatewayPaymentId,
      gatewayRefundId,
      amount: obj.amount ?? obj.amount_received ?? null,
      currency: obj.currency ?? null,
      method: obj.payment_method_types?.[0] ?? null,
      raw: body,
    };
  }

  async createRefund(gatewayPaymentId: string, amount: number, reason?: string): Promise<GatewayRefund> {
    const body = buildFormBody({
      payment_intent: gatewayPaymentId,
      amount: String(amount),
      ...(reason ? { reason: mapRefundReason(reason) } : {}),
    });

    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Stripe refund failed with HTTP ${response.status}: ${detail}`);
    }

    const refund = (await response.json()) as StripeRefundResponse;
    return {
      gatewayRefundId: refund.id,
      amount: refund.amount,
      status: refund.status === "succeeded" ? "processed" : refund.status === "failed" ? "failed" : "pending",
    };
  }
}

function buildFormBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// Stripe only accepts a fixed enum for refund reasons; anything else is
// dropped rather than sent as free text (which the API would reject).
function mapRefundReason(reason: string): string {
  const allowed = ["duplicate", "fraudulent", "requested_by_customer"];
  return allowed.includes(reason) ? reason : "requested_by_customer";
}
