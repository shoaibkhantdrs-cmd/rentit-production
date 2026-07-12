import test from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";

test("refresh rotates the token: old token stops working, new one works", async () => {
  const c = buildTestContainer();
  const { refreshToken: token1 } = await c.registerUser.execute({
    name: "Rotator",
    email: "rotate@example.com",
    device: TEST_DEVICE,
  });

  const { accessToken, refreshToken: token2 } = await c.refreshToken.execute({
    refreshToken: token1,
    ipAddress: "1.2.3.4",
    userAgent: "agent",
  });

  assert.ok(accessToken);
  assert.notEqual(token2, token1, "rotation must issue a brand new refresh token");

  // The newly rotated token keeps working across a second hop.
  const { refreshToken: token3 } = await c.refreshToken.execute({
    refreshToken: token2,
    ipAddress: null,
    userAgent: null,
  });
  assert.notEqual(token3, token2);

  // Only *now* replay the original, long-superseded token1. This is
  // intentionally the last thing the test does: replaying it correctly
  // revokes the whole rotation family (see the dedicated reuse-detection
  // test below), which would otherwise also kill token2/token3 and make
  // the "still works across a second hop" assertions above order-dependent.
  await assert.rejects(() => c.refreshToken.execute({ refreshToken: token1, ipAddress: null, userAgent: null }));
});

test("replaying an already-rotated refresh token revokes the whole family (reuse detection)", async () => {
  const c = buildTestContainer();
  const { refreshToken: token1 } = await c.registerUser.execute({
    name: "Victim",
    email: "victim@example.com",
    device: TEST_DEVICE,
  });

  // Legitimate rotation.
  const { refreshToken: token2 } = await c.refreshToken.execute({
    refreshToken: token1,
    ipAddress: null,
    userAgent: null,
  });

  // Attacker (or a buggy client) replays the OLD, already-rotated token.
  await assert.rejects(
    () => c.refreshToken.execute({ refreshToken: token1, ipAddress: null, userAgent: null }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );

  // The reuse must have burned the *entire* family, including token2, which
  // was legitimately issued and otherwise still unexpired/unused.
  await assert.rejects(
    () => c.refreshToken.execute({ refreshToken: token2, ipAddress: null, userAgent: null }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );

  // Two events, by design: replaying token1 triggers the first
  // reuse-detected event AND revokes the family (including token2);
  // the follow-up attempt to use token2 above then *also* hits an
  // already-revoked token and logs its own reuse-detected event. Every
  // touch of a dead token in a burned family is audit-logged, not just
  // the first one.
  const reuseEvents = c.repos.auditLogRepo.entries.filter(
    (e) => e.action === "auth.refresh.reuse_detected",
  );
  assert.equal(reuseEvents.length, 2);
});

test("an expired refresh token is rejected", async () => {
  const c = buildTestContainer(undefined, {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 60, // 1 minute
    otpLength: 6,
    otpTtlSeconds: 300,
    otpMaxAttempts: 3,
  });
  const { refreshToken } = await c.registerUser.execute({
    name: "Expiring",
    email: "expiring@example.com",
    device: TEST_DEVICE,
  });

  c.clock.advance(61_000); // past the 60s TTL

  await assert.rejects(
    () => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );
});

test("logout revokes the session; the refresh token can no longer be used", async () => {
  const c = buildTestContainer();
  const { refreshToken } = await c.registerUser.execute({
    name: "Logout Test",
    email: "logout@example.com",
    device: TEST_DEVICE,
  });

  await c.logoutUser.execute({ refreshToken });

  await assert.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }));
});

test("logout is idempotent -- calling it twice does not throw", async () => {
  const c = buildTestContainer();
  const { refreshToken } = await c.registerUser.execute({
    name: "Idempotent",
    email: "idempotent@example.com",
    device: TEST_DEVICE,
  });

  await c.logoutUser.execute({ refreshToken });
  await c.logoutUser.execute({ refreshToken }); // should not throw
});

test("logout-all revokes every session/refresh token for the user across devices", async () => {
  const c = buildTestContainer();
  const { user, refreshToken: tokenA } = await c.registerUser.execute({
    name: "Multi Device",
    email: "multidevice@example.com",
    device: TEST_DEVICE,
  });
  const { refreshToken: tokenB } = await c.loginUser.execute({
    identifier: "multidevice@example.com",
    password: undefined,
    device: { ...TEST_DEVICE, deviceId: "device-2" },
  });
  // second device logs in via OTP
  const otpResult = await c.verifyOtp.execute({
    identifier: "multidevice@example.com",
    purpose: "login",
    code: "123456",
    device: { ...TEST_DEVICE, deviceId: "device-2" },
  });
  assert.equal(otpResult.authenticated, true);
  const tokenBResolved = otpResult.authenticated ? otpResult.refreshToken : tokenB;

  const { revokedSessions } = await c.logoutAllDevices.execute({ userId: user.id });
  assert.equal(revokedSessions, 2);

  await assert.rejects(() => c.refreshToken.execute({ refreshToken: tokenA, ipAddress: null, userAgent: null }));
  await assert.rejects(() =>
    c.refreshToken.execute({ refreshToken: tokenBResolved, ipAddress: null, userAgent: null }),
  );
});
