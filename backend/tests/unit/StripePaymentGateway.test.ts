import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { StripePaymentGateway } from "@/infrastructure/payments/StripePaymentGateway";

function makeGateway(toleranceSeconds = 300) {
  return new StripePaymentGateway({
    secretKey: "sk_test_123",
    webhookSecret: "whsec_test_stripe",
    webhookToleranceSeconds: toleranceSeconds,
  });
}

function signedHeader(body: Buffer, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${body.toString("utf8")}`;
  const v1 = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

test("verifyWebhookSignature accepts a correctly signed, fresh body", () => {
  const gateway = makeGateway();
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
  const now = Math.floor(Date.now() / 1000);
  const header = signedHeader(body, "whsec_test_stripe", now);
  assert.equal(gateway.verifyWebhookSignature(body, header), true);
});

test("verifyWebhookSignature rejects the wrong secret", () => {
  const gateway = makeGateway();
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
  const now = Math.floor(Date.now() / 1000);
  const header = signedHeader(body, "wrong_secret", now);
  assert.equal(gateway.verifyWebhookSignature(body, header), false);
});

test("verifyWebhookSignature rejects an expired timestamp (replay protection)", () => {
  const gateway = makeGateway(300);
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
  const old = Math.floor(Date.now() / 1000) - 10_000;
  const header = signedHeader(body, "whsec_test_stripe", old);
  assert.equal(gateway.verifyWebhookSignature(body, header), false);
});

test("verifyWebhookSignature rejects a malformed header", () => {
  const gateway = makeGateway();
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
  assert.equal(gateway.verifyWebhookSignature(body, "garbage"), false);
  assert.equal(gateway.verifyWebhookSignature(body, undefined), false);
});

test("verifyWebhookSignature rejects a tampered body even with a validly-formatted header", () => {
  const gateway = makeGateway();
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
  const now = Math.floor(Date.now() / 1000);
  const header = signedHeader(body, "whsec_test_stripe", now);
  const tampered = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.payment_failed" }));
  assert.equal(gateway.verifyWebhookSignature(tampered, header), false);
});

test("parseWebhookEvent maps payment_intent.succeeded correctly", () => {
  const gateway = makeGateway();
  const body = Buffer.from(
    JSON.stringify({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", amount_received: 19900, currency: "inr" } },
    }),
  );
  const parsed = gateway.parseWebhookEvent(body);
  assert.equal(parsed.eventId, "evt_1");
  assert.equal(parsed.eventType, "payment.succeeded");
  assert.equal(parsed.gatewayPaymentId, "pi_1");
  assert.equal(parsed.amount, 19900);
});

test("parseWebhookEvent maps charge.refunded correctly", () => {
  const gateway = makeGateway();
  const body = Buffer.from(
    JSON.stringify({
      id: "evt_2",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 9900, currency: "inr" } },
    }),
  );
  const parsed = gateway.parseWebhookEvent(body);
  assert.equal(parsed.eventType, "refund.processed");
  assert.equal(parsed.gatewayRefundId, "ch_1");
  assert.equal(parsed.gatewayPaymentId, "pi_1");
});
