"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const OtpVerifier_1 = require("@/application/auth/shared/OtpVerifier");
const InMemoryOtpRepository_1 = require("../support/fakes/InMemoryOtpRepository");
const FakeHasher_1 = require("../support/fakes/FakeHasher");
const FakeClock_1 = require("../support/fakes/FakeClock");
function setup() {
    const clock = new FakeClock_1.FakeClock();
    const otpRepo = new InMemoryOtpRepository_1.InMemoryOtpRepository(clock);
    const hasher = new FakeHasher_1.FakeHasher();
    const verifier = new OtpVerifier_1.OtpVerifier(otpRepo, hasher, clock);
    return { clock, otpRepo, hasher, verifier };
}
(0, node_test_1.default)("verifyAndConsume succeeds with the correct code and marks it consumed", async () => {
    const { otpRepo, hasher, verifier, clock } = setup();
    const codeHash = await hasher.hash("482913");
    const otp = await otpRepo.create({
        userId: "u1",
        purpose: "login",
        channel: "email",
        codeHash,
        maxAttempts: 3,
        expiresAt: new Date(clock.now().getTime() + 60_000),
    });
    await verifier.verifyAndConsume("u1", "login", "482913");
    strict_1.default.ok(otpRepo.codes.get(otp.id)?.consumedAt, "otp should be marked consumed");
});
(0, node_test_1.default)("verifyAndConsume throws on a missing/already-consumed OTP", async () => {
    const { verifier } = setup();
    await strict_1.default.rejects(() => verifier.verifyAndConsume("no-such-user", "login", "000000"), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
(0, node_test_1.default)("a wrong code increments attempts but does not consume the OTP", async () => {
    const { otpRepo, hasher, verifier, clock } = setup();
    const codeHash = await hasher.hash("111222");
    const otp = await otpRepo.create({
        userId: "u2",
        purpose: "login",
        channel: "email",
        codeHash,
        maxAttempts: 3,
        expiresAt: new Date(clock.now().getTime() + 60_000),
    });
    await strict_1.default.rejects(() => verifier.verifyAndConsume("u2", "login", "999999"));
    const stored = otpRepo.codes.get(otp.id);
    strict_1.default.equal(stored?.attempts, 1);
    strict_1.default.equal(stored?.consumedAt, null);
});
(0, node_test_1.default)("verifyAndConsume rejects once attempts reach maxAttempts, even with the right code", async () => {
    const { otpRepo, hasher, verifier, clock } = setup();
    const codeHash = await hasher.hash("555555");
    const otp = await otpRepo.create({
        userId: "u3",
        purpose: "login",
        channel: "email",
        codeHash,
        maxAttempts: 1,
        expiresAt: new Date(clock.now().getTime() + 60_000),
    });
    await otpRepo.incrementAttempts(otp.id); // simulate one prior wrong guess
    await strict_1.default.rejects(() => verifier.verifyAndConsume("u3", "login", "555555"), (err) => {
        strict_1.default.equal(err.constructor.name, "TooManyRequestsError");
        return true;
    });
});
(0, node_test_1.default)("verifyAndConsume rejects an expired code", async () => {
    const { otpRepo, hasher, verifier, clock } = setup();
    const codeHash = await hasher.hash("333444");
    await otpRepo.create({
        userId: "u4",
        purpose: "login",
        channel: "email",
        codeHash,
        maxAttempts: 3,
        expiresAt: new Date(clock.now().getTime() + 1000),
    });
    clock.advance(2000);
    await strict_1.default.rejects(() => verifier.verifyAndConsume("u4", "login", "333444"), (err) => {
        strict_1.default.equal(err.constructor.name, "UnauthorizedError");
        return true;
    });
});
