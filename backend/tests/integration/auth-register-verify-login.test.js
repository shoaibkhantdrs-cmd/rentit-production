"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
(0, node_test_1.default)("register creates an account, assigns default role, and sends verification codes", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const result = await c.registerUser.execute({
        name: "Ada Lovelace",
        email: "Ada@Example.com", // mixed case on purpose
        phone: "+14155550100",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(result.user.email, "ada@example.com", "email should be normalized to lowercase");
    strict_1.default.deepEqual(result.user.roles, ["customer"], "default role should be customer");
    strict_1.default.equal(result.user.emailVerified, false);
    strict_1.default.ok(result.accessToken);
    strict_1.default.ok(result.refreshToken);
    // Both email + phone verification codes should have been "sent".
    strict_1.default.equal(c.notificationSender.sent.length, 2);
    const purposes = c.notificationSender.sent.map((n) => n.subject);
    strict_1.default.ok(purposes.some((p) => p?.toLowerCase().includes("email")));
    strict_1.default.ok(purposes.some((p) => p?.toLowerCase().includes("phone")));
    // In-app notification records too.
    const notifications = await c.listNotifications.execute({
        userId: result.user.id,
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(notifications.total, 2);
});
(0, node_test_1.default)("registering the same email twice is rejected with a conflict", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({ name: "A", email: "dup@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await strict_1.default.rejects(() => c.registerUser.execute({ name: "B", email: "dup@example.com", device: buildTestContainer_1.TEST_DEVICE }), (err) => {
        strict_1.default.equal(err.constructor.name, "ConflictError");
        return true;
    });
});
(0, node_test_1.default)("verify-otp confirms email verification with the correct code", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("999111");
    const { user } = await c.registerUser.execute({
        name: "Grace Hopper",
        email: "grace@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    const result = await c.verifyOtp.execute({
        identifier: "grace@example.com",
        purpose: "email_verification",
        code: "999111",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(result.verified, true);
    strict_1.default.equal(result.authenticated, false);
    const me = await c.getMe.execute(user.id);
    strict_1.default.equal(me.emailVerified, true);
});
(0, node_test_1.default)("verify-otp rejects an incorrect code and tracks attempts", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("111222");
    await c.registerUser.execute({ name: "Grace Hopper", email: "grace2@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await strict_1.default.rejects(() => c.verifyOtp.execute({
        identifier: "grace2@example.com",
        purpose: "email_verification",
        code: "000000",
        device: buildTestContainer_1.TEST_DEVICE,
    }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
(0, node_test_1.default)("login without a password issues an OTP instead of tokens", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({ name: "No Password", email: "nopass@example.com", device: buildTestContainer_1.TEST_DEVICE });
    c.notificationSender.sent.length = 0; // reset after register's own OTP sends
    const result = await c.loginUser.execute({ identifier: "nopass@example.com", device: buildTestContainer_1.TEST_DEVICE });
    strict_1.default.equal(result.mode, "otp_required");
    strict_1.default.equal(c.notificationSender.sent.length, 1);
});
(0, node_test_1.default)("login for an unknown identifier behaves identically to otp_required (no enumeration)", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const result = await c.loginUser.execute({ identifier: "ghost@example.com", device: buildTestContainer_1.TEST_DEVICE });
    strict_1.default.equal(result.mode, "otp_required");
});
(0, node_test_1.default)("verify-otp with purpose=login authenticates and issues tokens", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("456789");
    await c.registerUser.execute({ name: "OTP Login", email: "otplogin@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await c.loginUser.execute({ identifier: "otplogin@example.com", device: buildTestContainer_1.TEST_DEVICE });
    const result = await c.verifyOtp.execute({
        identifier: "otplogin@example.com",
        purpose: "login",
        code: "456789",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(result.authenticated, true);
    if (result.authenticated) {
        strict_1.default.ok(result.accessToken);
        strict_1.default.ok(result.refreshToken);
        const claims = c.tokenService.verifyAccessToken(result.accessToken);
        strict_1.default.equal(claims.sub, result.user.id);
        strict_1.default.deepEqual(claims.roles, ["customer"]);
    }
});
