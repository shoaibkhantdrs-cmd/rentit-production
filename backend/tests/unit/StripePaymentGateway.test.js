"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const StripePaymentGateway_1 = require("@/infrastructure/payments/StripePaymentGateway");
function makeGateway(toleranceSeconds = 300) {
    return new StripePaymentGateway_1.StripePaymentGateway({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_test_stripe",
        webhookToleranceSeconds: toleranceSeconds,
    });
}
function signedHeader(body, secret, timestamp) {
    const signedPayload = `${timestamp}.${body.toString("utf8")}`;
    const v1 = (0, node_crypto_1.createHmac)("sha256", secret).update(signedPayload).digest("hex");
    return `t=${timestamp},v1=${v1}`;
}
(0, node_test_1.default)("verifyWebhookSignature accepts a correctly signed, fresh body", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
    const now = Math.floor(Date.now() / 1000);
    const header = signedHeader(body, "whsec_test_stripe", now);
    strict_1.default.equal(gateway.verifyWebhookSignature(body, header), true);
});
(0, node_test_1.default)("verifyWebhookSignature rejects the wrong secret", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
    const now = Math.floor(Date.now() / 1000);
    const header = signedHeader(body, "wrong_secret", now);
    strict_1.default.equal(gateway.verifyWebhookSignature(body, header), false);
});
(0, node_test_1.default)("verifyWebhookSignature rejects an expired timestamp (replay protection)", () => {
    const gateway = makeGateway(300);
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
    const old = Math.floor(Date.now() / 1000) - 10_000;
    const header = signedHeader(body, "whsec_test_stripe", old);
    strict_1.default.equal(gateway.verifyWebhookSignature(body, header), false);
});
(0, node_test_1.default)("verifyWebhookSignature rejects a malformed header", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
    strict_1.default.equal(gateway.verifyWebhookSignature(body, "garbage"), false);
    strict_1.default.equal(gateway.verifyWebhookSignature(body, undefined), false);
});
(0, node_test_1.default)("verifyWebhookSignature rejects a tampered body even with a validly-formatted header", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" }));
    const now = Math.floor(Date.now() / 1000);
    const header = signedHeader(body, "whsec_test_stripe", now);
    const tampered = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.payment_failed" }));
    strict_1.default.equal(gateway.verifyWebhookSignature(tampered, header), false);
});
(0, node_test_1.default)("parseWebhookEvent maps payment_intent.succeeded correctly", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({
        id: "evt_1",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_1", amount_received: 19900, currency: "inr" } },
    }));
    const parsed = gateway.parseWebhookEvent(body);
    strict_1.default.equal(parsed.eventId, "evt_1");
    strict_1.default.equal(parsed.eventType, "payment.succeeded");
    strict_1.default.equal(parsed.gatewayPaymentId, "pi_1");
    strict_1.default.equal(parsed.amount, 19900);
});
(0, node_test_1.default)("parseWebhookEvent maps charge.refunded correctly", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({
        id: "evt_2",
        type: "charge.refunded",
        data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 9900, currency: "inr" } },
    }));
    const parsed = gateway.parseWebhookEvent(body);
    strict_1.default.equal(parsed.eventType, "refund.processed");
    strict_1.default.equal(parsed.gatewayRefundId, "ch_1");
    strict_1.default.equal(parsed.gatewayPaymentId, "pi_1");
});
