import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateGatewayOrderInput,
  GatewayOrder,
  GatewayRefund,
  IPaymentGateway,
  ParsedWebhookEvent,
} from "@/domain/services/IPaymentGateway";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
}

interface RazorpayRefundResponse {
  id: string;
  amount: number;
  status: string; // "pending" | "processed" | "failed"
}

/**
 * Real Razorpay integration via `fetch` against Razorpay's REST API
 * (https://api.razorpay.com/v1) -- no `razorpay` npm SDK dependency,
 * matching the fetch-based pattern already used for WhatsApp/Twilio.
 * Orders API auth is HTTP Basic (key_id:key_secret); webhook auth is an
 * HMAC-SHA256 of the raw body, hex-encoded, in the X-Razorpay-Signature
 * header -- see https://razorpay.com/docs/webhooks/validate-test/.
 */
export class RazorpayPaymentGateway implements IPaymentGateway {
  readonly name = "razorpay" as const;

  constructor(private readonly config: RazorpayConfig) {}

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Razorpay order creation failed with HTTP ${response.status}: ${detail}`);
    }

    const order = (await response.json()) as RazorpayOrderResponse;
    return {
      gatewayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;

    const expected = createHmac("sha256", this.config.webhookSecret).update(rawBody).digest("hex");
    const providedBuf = Buffer.from(signatureHeader, "hex");
    const expectedBuf = Buffer.from(expected, "hex");

    // Malformed (non-hex, wrong-length) signatures must not reach
    // timingSafeEqual, which throws on a length mismatch.
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
  }

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    const body = JSON.parse(rawBody.toString("utf8")) as {
      id?: string;
      event: string;
      created_at: number;
      payload: {
        payment?: { entity: { id: string; order_id: string; amount: number; currency: string; method?: string } };
        refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
      };
    };

    // Razorpay's webhook payloads don't reliably carry a documented,
    // guaranteed-unique top-level event id across all account/API
    // versions -- verify against the current dashboard payload before
    // going live and prefer body.id if your account sends one (newer
    // payloads do). Falling back to a deterministic composite key keeps
    // the idempotency check correct either way.
    const payment = body.payload.payment?.entity;
    const refund = body.payload.refund?.entity;
    const eventId =
      body.id ?? `${body.event}:${payment?.id ?? refund?.id ?? "unknown"}:${body.created_at}`;

    let eventType: ParsedWebhookEvent["eventType"] = "unhandled";
    if (body.event === "payment.captured") eventType = "payment.succeeded";
    else if (body.event === "payment.failed") eventType = "payment.failed";
    else if (body.event === "refund.processed") eventType = "refund.processed";
    else if (body.event === "refund.failed") eventType = "refund.failed";

    return {
      eventId,
      eventType,
      gatewayOrderId: payment?.order_id ?? null,
      gatewayPaymentId: payment?.id ?? refund?.payment_id ?? null,
      gatewayRefundId: refund?.id ?? null,
      amount: payment?.amount ?? refund?.amount ?? null,
      currency: payment?.currency ?? null,
      method: payment?.method ?? null,
      raw: body,
    };
  }

  async createRefund(gatewayPaymentId: string, amount: number, reason?: string): Promise<GatewayRefund> {
    const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64");
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${gatewayPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, notes: reason ? { reason } : {} }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Razorpay refund failed with HTTP ${response.status}: ${detail}`);
    }

    const refund = (await response.json()) as RazorpayRefundResponse;
    return {
      gatewayRefundId: refund.id,
      amount: refund.amount,
      status: refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending",
    };
  }
}
