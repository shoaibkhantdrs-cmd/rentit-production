"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeHasher = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * Deterministic sha256-based stand-in for BcryptHasher, used only in
 * tests. It satisfies the exact same IHasher contract the real bcrypt
 * implementation does, so every use-case that depends on IHasher is
 * exercised identically either way -- what differs is cost/algorithm,
 * which is BcryptHasher's own concern (and outside what these tests, or
 * this sandbox, can exercise without the real `bcrypt` package installed).
 */
class FakeHasher {
    async hash(plainText) {
        return (0, node_crypto_1.createHash)("sha256").update(plainText).digest("hex");
    }
    async verify(plainText, hash) {
        return (await this.hash(plainText)) === hash;
    }
}
exports.FakeHasher = FakeHasher;
