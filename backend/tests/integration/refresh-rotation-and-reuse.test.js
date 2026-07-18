"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
(0, node_test_1.default)("refresh rotates the token: old token stops working, new one works", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { refreshToken: token1 } = await c.registerUser.execute({
        name: "Rotator",
        email: "rotate@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    const { accessToken, refreshToken: token2 } = await c.refreshToken.execute({
        refreshToken: token1,
        ipAddress: "1.2.3.4",
        userAgent: "agent",
    });
    strict_1.default.ok(accessToken);
    strict_1.default.notEqual(token2, token1, "rotation must issue a brand new refresh token");
    // The newly rotated token keeps working across a second hop.
    const { refreshToken: token3 } = await c.refreshToken.execute({
        refreshToken: token2,
        ipAddress: null,
        userAgent: null,
    });
    strict_1.default.notEqual(token3, token2);
    // Only *now* replay the original, long-superseded token1. This is
    // intentionally the last thing the test does: replaying it correctly
    // revokes the whole rotation family (see the dedicated reuse-detection
    // test below), which would otherwise also kill token2/token3 and make
    // the "still works across a second hop" assertions above order-dependent.
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken: token1, ipAddress: null, userAgent: null }));
});
(0, node_test_1.default)("replaying an already-rotated refresh token revokes the whole family (reuse detection)", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { refreshToken: token1 } = await c.registerUser.execute({
        name: "Victim",
        email: "victim@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    // Legitimate rotation.
    const { refreshToken: token2 } = await c.refreshToken.execute({
        refreshToken: token1,
        ipAddress: null,
        userAgent: null,
    });
    // Attacker (or a buggy client) replays the OLD, already-rotated token.
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken: token1, ipAddress: null, userAgent: null }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    // The reuse must have burned the *entire* family, including token2, which
    // was legitimately issued and otherwise still unexpired/unused.
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken: token2, ipAddress: null, userAgent: null }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    // Two events, by design: replaying token1 triggers the first
    // reuse-detected event AND revokes the family (including token2);
    // the follow-up attempt to use token2 above then *also* hits an
    // already-revoked token and logs its own reuse-detected event. Every
    // touch of a dead token in a burned family is audit-logged, not just
    // the first one.
    const reuseEvents = c.repos.auditLogRepo.entries.filter((e) => e.action === "auth.refresh.reuse_detected");
    strict_1.default.equal(reuseEvents.length, 2);
});
(0, node_test_1.default)("an expired refresh token is rejected", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)(undefined, {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 60, // 1 minute
        otpLength: 6,
        otpTtlSeconds: 300,
        otpMaxAttempts: 3,
    });
    const { refreshToken } = await c.registerUser.execute({
        name: "Expiring",
        email: "expiring@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    c.clock.advance(61_000); // past the 60s TTL
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
(0, node_test_1.default)("logout revokes the session; the refresh token can no longer be used", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { refreshToken } = await c.registerUser.execute({
        name: "Logout Test",
        email: "logout@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await c.logoutUser.execute({ refreshToken });
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }));
});
(0, node_test_1.default)("logout is idempotent -- calling it twice does not throw", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { refreshToken } = await c.registerUser.execute({
        name: "Idempotent",
        email: "idempotent@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await c.logoutUser.execute({ refreshToken });
    await c.logoutUser.execute({ refreshToken }); // should not throw
});
(0, node_test_1.default)("logout-all revokes every session/refresh token for the user across devices", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user, refreshToken: tokenA } = await c.registerUser.execute({
        name: "Multi Device",
        email: "multidevice@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    const { refreshToken: tokenB } = await c.loginUser.execute({
        identifier: "multidevice@example.com",
        password: undefined,
        device: { ...buildTestContainer_1.TEST_DEVICE, deviceId: "device-2" },
    });
    // second device logs in via OTP
    const otpResult = await c.verifyOtp.execute({
        identifier: "multidevice@example.com",
        purpose: "login",
        code: "123456",
        device: { ...buildTestContainer_1.TEST_DEVICE, deviceId: "device-2" },
    });
    strict_1.default.equal(otpResult.authenticated, true);
    const tokenBResolved = otpResult.authenticated ? otpResult.refreshToken : tokenB;
    const { revokedSessions } = await c.logoutAllDevices.execute({ userId: user.id });
    strict_1.default.equal(revokedSessions, 2);
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken: tokenA, ipAddress: null, userAgent: null }));
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken: tokenBResolved, ipAddress: null, userAgent: null }));
});
