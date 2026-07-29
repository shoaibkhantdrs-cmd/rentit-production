"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtTokenService = void 0;
const node_crypto_1 = require("node:crypto");
const AppError_1 = require("../../domain/errors/AppError");
function base64url(input) {
    const buffer = typeof input === "string" ? Buffer.from(input) : input;
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input) {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
    return Buffer.from(padded, "base64");
}
/**
 * Hand-rolled HS256 JWT using only Node's built-in `crypto` -- no
 * `jsonwebtoken` dependency. Produces/verifies a real, spec-compliant JWT
 * (base64url header.payload.signature, HMAC-SHA256), it's just not built
 * on top of a third-party library. This also means it has zero install
 * footprint and its signing/verification logic is fully unit-testable
 * without any dependency being present.
 *
 * Refresh tokens are intentionally NOT JWTs -- see generateOpaqueToken().
 */
class JwtTokenService {
    config;
    constructor(config) {
        this.config = config;
    }
    signAccessToken(claims) {
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: "HS256", typ: "JWT" };
        const payload = {
            ...claims,
            iss: this.config.issuer,
            aud: this.config.audience,
            iat: now,
            exp: now + this.config.accessTokenTtlSeconds,
        };
        const headerB64 = base64url(JSON.stringify(header));
        const payloadB64 = base64url(JSON.stringify(payload));
        const signature = this.sign(`${headerB64}.${payloadB64}`);
        return `${headerB64}.${payloadB64}.${signature}`;
    }
    verifyAccessToken(token) {
        const parts = token.split(".");
        if (parts.length !== 3) {
            throw new AppError_1.UnauthorizedError("Malformed access token");
        }
        const [headerB64, payloadB64, signatureB64] = parts;
        const expectedSignature = this.sign(`${headerB64}.${payloadB64}`);
        const provided = base64urlDecode(signatureB64);
        const expected = base64urlDecode(expectedSignature);
        // Reject early on length mismatch: timingSafeEqual throws (rather than
        // returning false) if buffer lengths differ, which would otherwise
        // surface as a 500 instead of a 401.
        if (provided.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(provided, expected)) {
            throw new AppError_1.UnauthorizedError("Invalid access token signature");
        }
        let payload;
        try {
            payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
        }
        catch {
            throw new AppError_1.UnauthorizedError("Malformed access token payload");
        }
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            throw new AppError_1.UnauthorizedError("Access token expired");
        }
        if (payload.iss !== this.config.issuer) {
            throw new AppError_1.UnauthorizedError("Invalid access token issuer");
        }
        if (payload.aud !== this.config.audience) {
            throw new AppError_1.UnauthorizedError("Invalid access token audience");
        }
        return payload;
    }
    generateOpaqueToken() {
        // 256 bits of entropy, hex-encoded. Not a JWT: refresh tokens must be
        // revocable server-side before their natural expiry (logout, rotation,
        // reuse detection), which only works if the server looks them up by
        // value rather than trusting a self-contained signed blob.
        return (0, node_crypto_1.randomBytes)(32).toString("hex");
    }
    hashOpaqueToken(token) {
        return (0, node_crypto_1.createHmac)("sha256", this.config.secret).update(token).digest("hex");
    }
    sign(data) {
        return base64url((0, node_crypto_1.createHmac)("sha256", this.config.secret).update(data).digest());
    }
}
exports.JwtTokenService = JwtTokenService;
