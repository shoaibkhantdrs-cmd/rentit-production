"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
// --- Razorpay-style verification (copied logic under test) ---
function razorpayVerify(rawBody, signatureHeader, secret) {
    if (!signatureHeader)
        return false;
    const expected = (0, node_crypto_1.createHmac)("sha256", secret).update(rawBody).digest("hex");
    const providedBuf = Buffer.from(signatureHeader, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (providedBuf.length !== expectedBuf.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(providedBuf, expectedBuf);
}
// --- Stripe-style verification (copied logic under test) ---
function stripeVerify(rawBody, signatureHeader, secret, tolerance = 300) {
    if (!signatureHeader)
        return false;
    const parts = Object.fromEntries(signatureHeader.split(",").map((p) => { const [k, v] = p.split("="); return [k, v]; }));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1)
        return false;
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (!Number.isFinite(age) || age > tolerance || age < -tolerance)
        return false;
    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = (0, node_crypto_1.createHmac)("sha256", secret).update(signedPayload).digest("hex");
    const providedBuf = Buffer.from(v1, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (providedBuf.length !== expectedBuf.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(providedBuf, expectedBuf);
}
let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) {
        pass++;
        console.log(`PASS: ${name}`);
    }
    else {
        fail++;
        console.log(`FAIL: ${name}`);
    }
}
// Razorpay tests
const secret = "whsec_test_razorpay";
const body = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } }));
const validSig = (0, node_crypto_1.createHmac)("sha256", secret).update(body).digest("hex");
check("razorpay: valid signature accepted", razorpayVerify(body, validSig, secret) === true);
check("razorpay: wrong secret rejected", razorpayVerify(body, validSig, "wrong_secret") === false);
check("razorpay: tampered body rejected", razorpayVerify(Buffer.from(body.toString() + "x"), validSig, secret) === false);
check("razorpay: missing signature rejected", razorpayVerify(body, undefined, secret) === false);
check("razorpay: garbage signature rejected (no throw)", razorpayVerify(body, "not-hex-zz", secret) === false);
check("razorpay: truncated valid-hex signature rejected", razorpayVerify(body, validSig.slice(0, 10), secret) === false);
// Stripe tests
const stripeSecret = "whsec_test_stripe";
const stripeBody = Buffer.from(JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } }));
const now = Math.floor(Date.now() / 1000);
const signedPayload = `${now}.${stripeBody.toString("utf8")}`;
const v1 = (0, node_crypto_1.createHmac)("sha256", stripeSecret).update(signedPayload).digest("hex");
const header = `t=${now},v1=${v1}`;
check("stripe: valid signature accepted", stripeVerify(stripeBody, header, stripeSecret) === true);
check("stripe: wrong secret rejected", stripeVerify(stripeBody, header, "wrong") === false);
check("stripe: expired timestamp rejected", stripeVerify(stripeBody, `t=${now - 999999},v1=${v1}`, stripeSecret) === false);
check("stripe: missing v1 rejected", stripeVerify(stripeBody, `t=${now}`, stripeSecret) === false);
check("stripe: tampered body rejected", stripeVerify(Buffer.from(stripeBody.toString() + "x"), header, stripeSecret) === false);
check("stripe: future timestamp beyond tolerance rejected", stripeVerify(stripeBody, `t=${now + 999999},v1=${v1}`, stripeSecret) === false);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
