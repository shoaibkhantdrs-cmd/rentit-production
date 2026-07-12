import test from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";

test("register creates an account, assigns default role, and sends verification codes", async () => {
  const c = buildTestContainer();

  const result = await c.registerUser.execute({
    name: "Ada Lovelace",
    email: "Ada@Example.com", // mixed case on purpose
    phone: "+14155550100",
    device: TEST_DEVICE,
  });

  assert.equal(result.user.email, "ada@example.com", "email should be normalized to lowercase");
  assert.deepEqual(result.user.roles, ["customer"], "default role should be customer");
  assert.equal(result.user.emailVerified, false);
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);

  // Both email + phone verification codes should have been "sent".
  assert.equal(c.notificationSender.sent.length, 2);
  const purposes = c.notificationSender.sent.map((n) => n.subject);
  assert.ok(purposes.some((p) => p?.toLowerCase().includes("email")));
  assert.ok(purposes.some((p) => p?.toLowerCase().includes("phone")));

  // In-app notification records too.
  const notifications = await c.listNotifications.execute({
    userId: result.user.id,
    page: 1,
    pageSize: 10,
  });
  assert.equal(notifications.total, 2);
});

test("registering the same email twice is rejected with a conflict", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({ name: "A", email: "dup@example.com", device: TEST_DEVICE });

  await assert.rejects(
    () => c.registerUser.execute({ name: "B", email: "dup@example.com", device: TEST_DEVICE }),
    (err: Error) => {
      assert.equal(err.constructor.name, "ConflictError");
      return true;
    },
  );
});

test("verify-otp confirms email verification with the correct code", async () => {
  const c = buildTestContainer("999111");
  const { user } = await c.registerUser.execute({
    name: "Grace Hopper",
    email: "grace@example.com",
    device: TEST_DEVICE,
  });

  const result = await c.verifyOtp.execute({
    identifier: "grace@example.com",
    purpose: "email_verification",
    code: "999111",
    device: TEST_DEVICE,
  });

  assert.equal(result.verified, true);
  assert.equal(result.authenticated, false);

  const me = await c.getMe.execute(user.id);
  assert.equal(me.emailVerified, true);
});

test("verify-otp rejects an incorrect code and tracks attempts", async () => {
  const c = buildTestContainer("111222");
  await c.registerUser.execute({ name: "Grace Hopper", email: "grace2@example.com", device: TEST_DEVICE });

  await assert.rejects(
    () =>
      c.verifyOtp.execute({
        identifier: "grace2@example.com",
        purpose: "email_verification",
        code: "000000",
        device: TEST_DEVICE,
      }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );
});

test("login without a password issues an OTP instead of tokens", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({ name: "No Password", email: "nopass@example.com", device: TEST_DEVICE });
  c.notificationSender.sent.length = 0; // reset after register's own OTP sends

  const result = await c.loginUser.execute({ identifier: "nopass@example.com", device: TEST_DEVICE });

  assert.equal(result.mode, "otp_required");
  assert.equal(c.notificationSender.sent.length, 1);
});

test("login for an unknown identifier behaves identically to otp_required (no enumeration)", async () => {
  const c = buildTestContainer();
  const result = await c.loginUser.execute({ identifier: "ghost@example.com", device: TEST_DEVICE });
  assert.equal(result.mode, "otp_required");
});

test("verify-otp with purpose=login authenticates and issues tokens", async () => {
  const c = buildTestContainer("456789");
  await c.registerUser.execute({ name: "OTP Login", email: "otplogin@example.com", device: TEST_DEVICE });
  await c.loginUser.execute({ identifier: "otplogin@example.com", device: TEST_DEVICE });

  const result = await c.verifyOtp.execute({
    identifier: "otplogin@example.com",
    purpose: "login",
    code: "456789",
    device: TEST_DEVICE,
  });

  assert.equal(result.authenticated, true);
  if (result.authenticated) {
    assert.ok(result.accessToken);
    assert.ok(result.refreshToken);
    const claims = c.tokenService.verifyAccessToken(result.accessToken);
    assert.equal(claims.sub, result.user.id);
    assert.deepEqual(claims.roles, ["customer"]);
  }
});
