"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
(0, node_test_1.default)("OTP verification is locked out after max attempts", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("777777", {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        otpLength: 6,
        otpTtlSeconds: 300,
        otpMaxAttempts: 2,
    });
    await c.registerUser.execute({ name: "Locked", email: "locked@example.com", device: buildTestContainer_1.TEST_DEVICE });
    const wrongAttempt = () => c.verifyOtp.execute({
        identifier: "locked@example.com",
        purpose: "email_verification",
        code: "000000",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await strict_1.default.rejects(wrongAttempt, (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    await strict_1.default.rejects(wrongAttempt, (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
    // Third attempt: attempts (2) >= maxAttempts (2) -> locked out, even with
    // the CORRECT code now.
    await strict_1.default.rejects(() => c.verifyOtp.execute({
        identifier: "locked@example.com",
        purpose: "email_verification",
        code: "777777",
        device: buildTestContainer_1.TEST_DEVICE,
    }), (err) => {
        strict_1.default.equal(err.constructor.name, "TooManyRequestsError");
        return true;
    });
});
(0, node_test_1.default)("verify-otp rejects purpose=password_reset (must go through reset-password instead)", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({ name: "X", email: "guard@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await strict_1.default.rejects(() => c.verifyOtp.execute({
        identifier: "guard@example.com",
        // @ts-expect-error -- intentionally invalid purpose for this endpoint
        purpose: "password_reset",
        code: "123456",
        device: buildTestContainer_1.TEST_DEVICE,
    }), (err) => {
        strict_1.default.equal(err.constructor.name, "ValidationError");
        return true;
    });
});
(0, node_test_1.default)("an expired OTP is rejected even with the correct code", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("222333", {
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        otpLength: 6,
        otpTtlSeconds: 60,
        otpMaxAttempts: 5,
    });
    await c.registerUser.execute({ name: "Expiry", email: "otpexpiry@example.com", device: buildTestContainer_1.TEST_DEVICE });
    c.clock.advance(61_000);
    await strict_1.default.rejects(() => c.verifyOtp.execute({
        identifier: "otpexpiry@example.com",
        purpose: "email_verification",
        code: "222333",
        device: buildTestContainer_1.TEST_DEVICE,
    }), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
(0, node_test_1.default)("registering without a phone succeeds and skips the phone_verification OTP", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const result = await c.registerUser.execute({
        name: "No Phone",
        email: "nophone2@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    strict_1.default.equal(result.user.phone, null);
    strict_1.default.equal(c.notificationSender.sent.length, 1, "only the email verification OTP should be sent");
});
