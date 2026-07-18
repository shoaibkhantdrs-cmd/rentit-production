"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
(0, node_test_1.default)("register with a password, then log in with that password directly (no OTP)", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({
        name: "Password User",
        email: "pw@example.com",
        password: "Sup3rSecret!",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    c.notificationSender.sent.length = 0;
    const result = await c.loginUser.execute({
        identifier: "pw@example.com",
        password: "Sup3rSecret!",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(result.mode, "authenticated");
    strict_1.default.equal(c.notificationSender.sent.length, 0, "password login should not send an OTP");
});
(0, node_test_1.default)("wrong password is rejected and audit-logged", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({
        name: "Password User",
        email: "pw2@example.com",
        password: "Sup3rSecret!",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await strict_1.default.rejects(() => c.loginUser.execute({ identifier: "pw2@example.com", password: "wrong-password", device: buildTestContainer_1.TEST_DEVICE }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    const failedLogins = c.repos.auditLogRepo.entries.filter((e) => e.action === "auth.login.failed");
    strict_1.default.equal(failedLogins.length, 1);
});
(0, node_test_1.default)("forgot-password never reveals whether the email exists", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({ name: "Real User", email: "real@example.com", device: buildTestContainer_1.TEST_DEVICE });
    c.notificationSender.sent.length = 0;
    await c.forgotPassword.execute({ email: "real@example.com" });
    await c.forgotPassword.execute({ email: "ghost@example.com" });
    // Only the real user actually gets a code sent -- but both calls resolve
    // identically from the caller's perspective (no thrown error either way).
    strict_1.default.equal(c.notificationSender.sent.length, 1);
});
(0, node_test_1.default)("reset-password with a valid code changes the password and revokes existing sessions", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("654321");
    const { user, refreshToken } = await c.registerUser.execute({
        name: "Reset Me",
        email: "reset@example.com",
        password: "OldPassword1",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await c.forgotPassword.execute({ email: "reset@example.com" });
    await c.resetPassword.execute({ email: "reset@example.com", code: "654321", newPassword: "NewPassword1" });
    // Old refresh token must now be dead.
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    // Old password no longer works; new one does.
    await strict_1.default.rejects(() => c.loginUser.execute({ identifier: "reset@example.com", password: "OldPassword1", device: buildTestContainer_1.TEST_DEVICE }));
    const loggedIn = await c.loginUser.execute({
        identifier: "reset@example.com",
        password: "NewPassword1",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(loggedIn.mode, "authenticated");
    // A "your password changed" notification should exist.
    const notifications = await c.listNotifications.execute({ userId: user.id, page: 1, pageSize: 20 });
    strict_1.default.ok(notifications.items.some((n) => n.type === "security.password_changed"));
});
(0, node_test_1.default)("reset-password rejects an incorrect code without revealing account existence", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("111111");
    await c.registerUser.execute({ name: "X", email: "resetfail@example.com", password: "abc12345", device: buildTestContainer_1.TEST_DEVICE });
    await c.forgotPassword.execute({ email: "resetfail@example.com" });
    await strict_1.default.rejects(() => c.resetPassword.execute({ email: "resetfail@example.com", code: "000000", newPassword: "whatever1" }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    await strict_1.default.rejects(() => c.resetPassword.execute({ email: "no-such-user@example.com", code: "000000", newPassword: "whatever1" }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
