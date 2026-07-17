import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { RazorpayPaymentGateway } from "@/infrastructure/payments/RazorpayPaymentGateway";

function makeGateway() {
  return new RazorpayPaymentGateway({
    keyId: "rzp_test_key",
    keySecret: "test_key_secret",
    webhookSecret: "whsec_test_razorpay",
  });
}

function signedBody(payload: object, secret: string): { body: Buffer; signature: string } {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return { body, signature };
}

test("verifyWebhookSignature accepts a correctly signed body", () => {
  const gateway = makeGateway();
  const { body, signature } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
  assert.equal(gateway.verifyWebhookSignature(body, signature), true);
});

test("verifyWebhookSignature rejects a body signed with the wrong secret", () => {
  const gateway = makeGateway();
  const { body, signature } = signedBody({ event: "payment.captured" }, "some_other_secret");
  assert.equal(gateway.verifyWebhookSignature(body, signature), false);
});

test("verifyWebhookSignature rejects a tampered body", () => {
  const gateway = makeGateway();
  const { body, signature } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
  const tampered = Buffer.from(body.toString("utf8").replace("captured", "failed"));
  assert.equal(gateway.verifyWebhookSignature(tampered, signature), false);
});

test("verifyWebhookSignature rejects a missing signature header", () => {
  const gateway = makeGateway();
  const { body } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
  assert.equal(gateway.verifyWebhookSignature(body, undefined), false);
});

test("verifyWebhookSignature never throws on a malformed (non-hex) header", () => {
  const gateway = makeGateway();
  const { body } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
  assert.doesNotThrow(() => gateway.verifyWebhookSignature(body, "not-a-valid-signature"));
  assert.equal(gateway.verifyWebhookSignature(body, "not-a-valid-signature"), false);
});

test("parseWebhookEvent maps payment.captured to payment.succeeded with ids extracted", () => {
  const gateway = makeGateway();
  const body = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      created_at: 1700000000,
      payload: {
        payment: {
          entity: { id: "pay_123", order_id: "order_456", amount: 19900, currency: "INR", method: "card" },
        },
      },
    }),
  );

  const parsed = gateway.parseWebhookEvent(body);
  assert.equal(parsed.eventType, "payment.succeeded");
  assert.equal(parsed.gatewayPaymentId, "pay_123");
  assert.equal(parsed.gatewayOrderId, "order_456");
  assert.equal(parsed.amount, 19900);
  assert.equal(parsed.currency, "INR");
  assert.equal(parsed.method, "card");
});

test("parseWebhookEvent maps refund.processed with the refund's payment_id", () => {
  const gateway = makeGateway();
  const body = Buffer.from(
    JSON.stringify({
      event: "refund.processed",
      created_at: 1700000000,
      payload: {
        refund: { entity: { id: "rfnd_1", payment_id: "pay_123", amount: 9900, status: "processed" } },
      },
    }),
  );

  const parsed = gateway.parseWebhookEvent(body);
  assert.equal(parsed.eventType, "refund.processed");
  assert.equal(parsed.gatewayRefundId, "rfnd_1");
  assert.equal(parsed.gatewayPaymentId, "pay_123");
});

test("parseWebhookEvent returns 'unhandled' for an event type this app doesn't act on", () => {
  const gateway = makeGateway();
  const body = Buffer.from(
    JSON.stringify({ event: "order.paid", created_at: 1700000000, payload: {} }),
  );
  assert.equal(gateway.parseWebhookEvent(body).eventType, "unhandled");
});
