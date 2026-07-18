"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const RazorpayPaymentGateway_1 = require("@/infrastructure/payments/RazorpayPaymentGateway");
function makeGateway() {
    return new RazorpayPaymentGateway_1.RazorpayPaymentGateway({
        keyId: "rzp_test_key",
        keySecret: "test_key_secret",
        webhookSecret: "whsec_test_razorpay",
    });
}
function signedBody(payload, secret) {
    const body = Buffer.from(JSON.stringify(payload));
    const signature = (0, node_crypto_1.createHmac)("sha256", secret).update(body).digest("hex");
    return { body, signature };
}
(0, node_test_1.default)("verifyWebhookSignature accepts a correctly signed body", () => {
    const gateway = makeGateway();
    const { body, signature } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
    strict_1.default.equal(gateway.verifyWebhookSignature(body, signature), true);
});
(0, node_test_1.default)("verifyWebhookSignature rejects a body signed with the wrong secret", () => {
    const gateway = makeGateway();
    const { body, signature } = signedBody({ event: "payment.captured" }, "some_other_secret");
    strict_1.default.equal(gateway.verifyWebhookSignature(body, signature), false);
});
(0, node_test_1.default)("verifyWebhookSignature rejects a tampered body", () => {
    const gateway = makeGateway();
    const { body, signature } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
    const tampered = Buffer.from(body.toString("utf8").replace("captured", "failed"));
    strict_1.default.equal(gateway.verifyWebhookSignature(tampered, signature), false);
});
(0, node_test_1.default)("verifyWebhookSignature rejects a missing signature header", () => {
    const gateway = makeGateway();
    const { body } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
    strict_1.default.equal(gateway.verifyWebhookSignature(body, undefined), false);
});
(0, node_test_1.default)("verifyWebhookSignature never throws on a malformed (non-hex) header", () => {
    const gateway = makeGateway();
    const { body } = signedBody({ event: "payment.captured" }, "whsec_test_razorpay");
    strict_1.default.doesNotThrow(() => gateway.verifyWebhookSignature(body, "not-a-valid-signature"));
    strict_1.default.equal(gateway.verifyWebhookSignature(body, "not-a-valid-signature"), false);
});
(0, node_test_1.default)("parseWebhookEvent maps payment.captured to payment.succeeded with ids extracted", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({
        event: "payment.captured",
        created_at: 1700000000,
        payload: {
            payment: {
                entity: { id: "pay_123", order_id: "order_456", amount: 19900, currency: "INR", method: "card" },
            },
        },
    }));
    const parsed = gateway.parseWebhookEvent(body);
    strict_1.default.equal(parsed.eventType, "payment.succeeded");
    strict_1.default.equal(parsed.gatewayPaymentId, "pay_123");
    strict_1.default.equal(parsed.gatewayOrderId, "order_456");
    strict_1.default.equal(parsed.amount, 19900);
    strict_1.default.equal(parsed.currency, "INR");
    strict_1.default.equal(parsed.method, "card");
});
(0, node_test_1.default)("parseWebhookEvent maps refund.processed with the refund's payment_id", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({
        event: "refund.processed",
        created_at: 1700000000,
        payload: {
            refund: { entity: { id: "rfnd_1", payment_id: "pay_123", amount: 9900, status: "processed" } },
        },
    }));
    const parsed = gateway.parseWebhookEvent(body);
    strict_1.default.equal(parsed.eventType, "refund.processed");
    strict_1.default.equal(parsed.gatewayRefundId, "rfnd_1");
    strict_1.default.equal(parsed.gatewayPaymentId, "pay_123");
});
(0, node_test_1.default)("parseWebhookEvent returns 'unhandled' for an event type this app doesn't act on", () => {
    const gateway = makeGateway();
    const body = Buffer.from(JSON.stringify({ event: "order.paid", created_at: 1700000000, payload: {} }));
    strict_1.default.equal(gateway.parseWebhookEvent(body).eventType, "unhandled");
});
