import test from "node:test";
import assert from "node:assert/strict";
import { OtpVerifier } from "@/application/auth/shared/OtpVerifier";
import { InMemoryOtpRepository } from "../support/fakes/InMemoryOtpRepository";
import { FakeHasher } from "../support/fakes/FakeHasher";
import { FakeClock } from "../support/fakes/FakeClock";

function setup() {
  const clock = new FakeClock();
  const otpRepo = new InMemoryOtpRepository(clock);
  const hasher = new FakeHasher();
  const verifier = new OtpVerifier(otpRepo, hasher, clock);
  return { clock, otpRepo, hasher, verifier };
}

test("verifyAndConsume succeeds with the correct code and marks it consumed", async () => {
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

  assert.ok(otpRepo.codes.get(otp.id)?.consumedAt, "otp should be marked consumed");
});

test("verifyAndConsume throws on a missing/already-consumed OTP", async () => {
  const { verifier } = setup();
  await assert.rejects(() => verifier.verifyAndConsume("no-such-user", "login", "000000"), (err: Error) => {
    assert.equal(err.constructor.name, "UnauthorizedError");
    return true;
  });
});

test("a wrong code increments attempts but does not consume the OTP", async () => {
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

  await assert.rejects(() => verifier.verifyAndConsume("u2", "login", "999999"));

  const stored = otpRepo.codes.get(otp.id);
  assert.equal(stored?.attempts, 1);
  assert.equal(stored?.consumedAt, null);
});

test("verifyAndConsume rejects once attempts reach maxAttempts, even with the right code", async () => {
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

  await assert.rejects(() => verifier.verifyAndConsume("u3", "login", "555555"), (err: Error) => {
    assert.equal(err.constructor.name, "TooManyRequestsError");
    return true;
  });
});

test("verifyAndConsume rejects an expired code", async () => {
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

  await assert.rejects(() => verifier.verifyAndConsume("u4", "login", "333444"), (err: Error) => {
    assert.equal(err.constructor.name, "UnauthorizedError");
    return true;
  });
});
