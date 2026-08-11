import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Request, Response } from "express";
import { WebhookController } from "@/interfaces/http/controllers/WebhookController";
import { HandlePaymentWebhookUseCase } from "@/application/payments/HandlePaymentWebhook.usecase";

// Covers the "webhook secret not configured" behavior added alongside
// env.ts's razorpay/stripe.webhookSecretConfigured: WebhookController is
// constructed with `null` in place of a provider's HandlePaymentWebhookUseCase
// when container.ts finds that provider's webhook secret unset (see
// container.ts's comment above handleRazorpayWebhook/handleStripeWebhook).
// The controller must reject that provider's requests outright -- 503,
// never processed -- rather than ever calling a gateway's
// verifyWebhookSignature() with an empty-string secret, which anyone could
// replicate without knowing a real one.

function fakeReq(rawBody: Buffer | undefined, headerValue: string | undefined): Request {
  return {
    rawBody,
    header: () => headerValue,
  } as unknown as Request;
}

function fakeRes(): { res: Response; statusCode: () => number | undefined; body: () => unknown } {
  let statusCode: number | undefined;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
  } as unknown as Response;
  return { res, statusCode: () => statusCode, body: () => body };
}

test("razorpay: returns 503 and never invokes the use case when unconfigured (null)", async () => {
  const controller = new WebhookController(null, null);
  const { res, statusCode, body } = fakeRes();
  const req = fakeReq(Buffer.from("{}"), "some-signature");

  await controller.razorpay(req, res);

  assert.equal(statusCode(), 503);
  assert.equal((body() as { received: boolean }).received, false);
});

test("stripe: returns 503 and never invokes the use case when unconfigured (null)", async () => {
  const controller = new WebhookController(null, null);
  const { res, statusCode, body } = fakeRes();
  const req = fakeReq(Buffer.from("{}"), "t=123,v1=abc");

  await controller.stripe(req, res);

  assert.equal(statusCode(), 503);
  assert.equal((body() as { received: boolean }).received, false);
});

test("razorpay: with a configured use case, a validly signed request is still processed as before", async () => {
  let calledWith: [Buffer, string | undefined] | undefined;
  const stubUseCase = {
    execute: async (rawBody: Buffer, signature: string | undefined) => {
      calledWith = [rawBody, signature];
      return { duplicate: false, eventType: "payment.succeeded" };
    },
  } as unknown as HandlePaymentWebhookUseCase;

  const controller = new WebhookController(stubUseCase, null);
  const { res, statusCode, body } = fakeRes();

  const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  const signature = createHmac("sha256", "whsec_test").update(rawBody).digest("hex");
  const req = fakeReq(rawBody, signature);

  await controller.razorpay(req, res);

  assert.equal(statusCode(), 200);
  assert.equal((body() as { received: boolean }).received, true);
  assert.ok(calledWith);
  assert.equal(calledWith?.[1], signature);
});

test("stripe: with a configured use case, a validly signed request is still processed as before", async () => {
  let calledWith: [Buffer, string | undefined] | undefined;
  const stubUseCase = {
    execute: async (rawBody: Buffer, signature: string | undefined) => {
      calledWith = [rawBody, signature];
      return { duplicate: false, eventType: "payment.succeeded" };
    },
  } as unknown as HandlePaymentWebhookUseCase;

  const controller = new WebhookController(null, stubUseCase);
  const { res, statusCode, body } = fakeRes();

  const rawBody = Buffer.from(JSON.stringify({ type: "payment_intent.succeeded" }));
  const req = fakeReq(rawBody, "t=1700000000,v1=abcdef");

  await controller.stripe(req, res);

  assert.equal(statusCode(), 200);
  assert.equal((body() as { received: boolean }).received, true);
  assert.ok(calledWith);
});

test("razorpay: missing rawBody still returns 400 when configured (existing behavior unchanged)", async () => {
  const stubUseCase = {
    execute: async () => ({ duplicate: false, eventType: "payment.succeeded" }),
  } as unknown as HandlePaymentWebhookUseCase;
  const controller = new WebhookController(stubUseCase, null);
  const { res, statusCode, body } = fakeRes();
  const req = fakeReq(undefined, "some-signature");

  await controller.razorpay(req, res);

  assert.equal(statusCode(), 400);
  assert.equal((body() as { received: boolean }).received, false);
});
