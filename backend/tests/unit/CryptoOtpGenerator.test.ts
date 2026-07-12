import test from "node:test";
import assert from "node:assert/strict";
import { CryptoOtpGenerator } from "@/infrastructure/security/CryptoOtpGenerator";

test("generates a code of exactly the requested length, zero-padded", () => {
  const gen = new CryptoOtpGenerator();
  for (let i = 0; i < 200; i += 1) {
    const code = gen.generate(6);
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  }
});

test("supports different lengths", () => {
  const gen = new CryptoOtpGenerator();
  assert.equal(gen.generate(4).length, 4);
  assert.equal(gen.generate(8).length, 8);
});

test("produces a reasonable spread of values (not a constant)", () => {
  const gen = new CryptoOtpGenerator();
  const values = new Set<string>();
  for (let i = 0; i < 50; i += 1) values.add(gen.generate(6));
  // With 50 draws from 1e6 possibilities, collisions should be rare;
  // this just guards against an accidentally-constant generator.
  assert.ok(values.size > 40, `expected high uniqueness, got ${values.size}/50`);
});
