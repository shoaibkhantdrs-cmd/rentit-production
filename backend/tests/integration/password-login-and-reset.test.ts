import test from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";

test("register with a password, then log in with that password directly (no OTP)", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({
    name: "Password User",
    email: "pw@example.com",
    password: "Sup3rSecret!",
    device: TEST_DEVICE,
  });
  c.notificationSender.sent.length = 0;

  const result = await c.loginUser.execute({
    identifier: "pw@example.com",
    password: "Sup3rSecret!",
    device: TEST_DEVICE,
  });

  assert.equal(result.mode, "authenticated");
  assert.equal(c.notificationSender.sent.length, 0, "password login should not send an OTP");
});

test("wrong password is rejected and audit-logged", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({
    name: "Password User",
    email: "pw2@example.com",
    password: "Sup3rSecret!",
    device: TEST_DEVICE,
  });

  await assert.rejects(
    () =>
      c.loginUser.execute({ identifier: "pw2@example.com", password: "wrong-password", device: TEST_DEVICE }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );

  const failedLogins = c.repos.auditLogRepo.entries.filter((e) => e.action === "auth.login.failed");
  assert.equal(failedLogins.length, 1);
});

test("forgot-password never reveals whether the email exists", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({ name: "Real User", email: "real@example.com", device: TEST_DEVICE });
  c.notificationSender.sent.length = 0;

  await c.forgotPassword.execute({ email: "real@example.com" });
  await c.forgotPassword.execute({ email: "ghost@example.com" });

  // Only the real user actually gets a code sent -- but both calls resolve
  // identically from the caller's perspective (no thrown error either way).
  assert.equal(c.notificationSender.sent.length, 1);
});

test("reset-password with a valid code changes the password and revokes existing sessions", async () => {
  const c = buildTestContainer("654321");
  const { user, refreshToken } = await c.registerUser.execute({
    name: "Reset Me",
    email: "reset@example.com",
    password: "OldPassword1",
    device: TEST_DEVICE,
  });

  await c.forgotPassword.execute({ email: "reset@example.com" });
  await c.resetPassword.execute({ email: "reset@example.com", code: "654321", newPassword: "NewPassword1" });

  // Old refresh token must now be dead.
  await assert.rejects(
    () => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );

  // Old password no longer works; new one does.
  await assert.rejects(() =>
    c.loginUser.execute({ identifier: "reset@example.com", password: "OldPassword1", device: TEST_DEVICE }),
  );
  const loggedIn = await c.loginUser.execute({
    identifier: "reset@example.com",
    password: "NewPassword1",
    device: TEST_DEVICE,
  });
  assert.equal(loggedIn.mode, "authenticated");

  // A "your password changed" notification should exist.
  const notifications = await c.listNotifications.execute({ userId: user.id, page: 1, pageSize: 20 });
  assert.ok(notifications.items.some((n) => n.type === "security.password_changed"));
});

test("reset-password rejects an incorrect code without revealing account existence", async () => {
  const c = buildTestContainer("111111");
  await c.registerUser.execute({ name: "X", email: "resetfail@example.com", password: "abc12345", device: TEST_DEVICE });
  await c.forgotPassword.execute({ email: "resetfail@example.com" });

  await assert.rejects(
    () =>
      c.resetPassword.execute({ email: "resetfail@example.com", code: "000000", newPassword: "whatever1" }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );

  await assert.rejects(
    () => c.resetPassword.execute({ email: "no-such-user@example.com", code: "000000", newPassword: "whatever1" }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );
});
