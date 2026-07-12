import test from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";

test("OTP verification is locked out after max attempts", async () => {
  const c = buildTestContainer("777777", {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    otpLength: 6,
    otpTtlSeconds: 300,
    otpMaxAttempts: 2,
  });
  await c.registerUser.execute({ name: "Locked", email: "locked@example.com", device: TEST_DEVICE });

  const wrongAttempt = () =>
    c.verifyOtp.execute({
      identifier: "locked@example.com",
      purpose: "email_verification",
      code: "000000",
      device: TEST_DEVICE,
    });

  await assert.rejects(wrongAttempt, (err: Error) => {
    assert.equal(err.constructor.name, "UnauthorizedError");
    return true;
  });
  await assert.rejects(wrongAttempt, (err: Error) => {
    assert.equal(err.constructor.name, "UnauthorizedError");
    return true;
  });

  // Third attempt: attempts (2) >= maxAttempts (2) -> locked out, even with
  // the CORRECT code now.
  await assert.rejects(
    () =>
      c.verifyOtp.execute({
        identifier: "locked@example.com",
        purpose: "email_verification",
        code: "777777",
        device: TEST_DEVICE,
      }),
    (err: Error) => {
      assert.equal(err.constructor.name, "TooManyRequestsError");
      return true;
    },
  );
});

test("verify-otp rejects purpose=password_reset (must go through reset-password instead)", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({ name: "X", email: "guard@example.com", device: TEST_DEVICE });

  await assert.rejects(
    () =>
      c.verifyOtp.execute({
        identifier: "guard@example.com",
        // @ts-expect-error -- intentionally invalid purpose for this endpoint
        purpose: "password_reset",
        code: "123456",
        device: TEST_DEVICE,
      }),
    (err: Error) => {
      assert.equal(err.constructor.name, "ValidationError");
      return true;
    },
  );
});

test("an expired OTP is rejected even with the correct code", async () => {
  const c = buildTestContainer("222333", {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    otpLength: 6,
    otpTtlSeconds: 60,
    otpMaxAttempts: 5,
  });
  await c.registerUser.execute({ name: "Expiry", email: "otpexpiry@example.com", device: TEST_DEVICE });

  c.clock.advance(61_000);

  await assert.rejects(
    () =>
      c.verifyOtp.execute({
        identifier: "otpexpiry@example.com",
        purpose: "email_verification",
        code: "222333",
        device: TEST_DEVICE,
      }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );
});

test("registering without a phone succeeds and skips the phone_verification OTP", async () => {
  const c = buildTestContainer();
  const result = await c.registerUser.execute({
    name: "No Phone",
    email: "nophone2@example.com",
    device: TEST_DEVICE,
  });
  assert.equal(result.user.phone, null);
  assert.equal(c.notificationSender.sent.length, 1, "only the email verification OTP should be sent");
});
