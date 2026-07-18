"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const CryptoOtpGenerator_1 = require("@/infrastructure/security/CryptoOtpGenerator");
(0, node_test_1.default)("generates a code of exactly the requested length, zero-padded", () => {
    const gen = new CryptoOtpGenerator_1.CryptoOtpGenerator();
    for (let i = 0; i < 200; i += 1) {
        const code = gen.generate(6);
        strict_1.default.equal(code.length, 6);
        strict_1.default.match(code, /^\d{6}$/);
    }
});
(0, node_test_1.default)("supports different lengths", () => {
    const gen = new CryptoOtpGenerator_1.CryptoOtpGenerator();
    strict_1.default.equal(gen.generate(4).length, 4);
    strict_1.default.equal(gen.generate(8).length, 8);
});
(0, node_test_1.default)("produces a reasonable spread of values (not a constant)", () => {
    const gen = new CryptoOtpGenerator_1.CryptoOtpGenerator();
    const values = new Set();
    for (let i = 0; i < 50; i += 1)
        values.add(gen.generate(6));
    // With 50 draws from 1e6 possibilities, collisions should be rare;
    // this just guards against an accidentally-constant generator.
    strict_1.default.ok(values.size > 40, `expected high uniqueness, got ${values.size}/50`);
});
