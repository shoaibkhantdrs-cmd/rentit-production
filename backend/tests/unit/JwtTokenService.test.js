"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const JwtTokenService_1 = require("@/infrastructure/security/JwtTokenService");
function makeService(overrides = {}) {
    return new JwtTokenService_1.JwtTokenService({
        secret: "unit-test-secret",
        issuer: "rentit",
        audience: "rentit-clients",
        accessTokenTtlSeconds: 900,
        ...overrides,
    });
}
(0, node_test_1.default)("signs and verifies a token round-trip", () => {
    const svc = makeService();
    const token = svc.signAccessToken({ sub: "user-1", roles: ["customer"], sessionId: "session-1" });
    const claims = svc.verifyAccessToken(token);
    strict_1.default.equal(claims.sub, "user-1");
    strict_1.default.deepEqual(claims.roles, ["customer"]);
    strict_1.default.equal(claims.sessionId, "session-1");
    strict_1.default.ok(claims.exp > claims.iat);
});
(0, node_test_1.default)("produces a real three-part base64url JWT", () => {
    const svc = makeService();
    const token = svc.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
    const parts = token.split(".");
    strict_1.default.equal(parts.length, 3);
    for (const part of parts) {
        strict_1.default.doesNotMatch(part, /[+/=]/, "must be base64url, not base64");
    }
});
(0, node_test_1.default)("rejects a token signed with a different secret", () => {
    const svc = makeService();
    const other = makeService({ secret: "different-secret" });
    const token = other.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
    strict_1.default.throws(() => svc.verifyAccessToken(token), /Invalid access token signature/);
});
(0, node_test_1.default)("rejects a tampered payload even if the signature format is otherwise valid", () => {
    const svc = makeService();
    const token = svc.signAccessToken({ sub: "u", roles: ["customer"], sessionId: "s" });
    const [header, payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, roles: ["super_admin"] })).toString("base64url");
    strict_1.default.throws(() => svc.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`));
});
(0, node_test_1.default)("rejects an expired token", () => {
    const svc = makeService({ accessTokenTtlSeconds: -1 });
    const token = svc.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
    strict_1.default.throws(() => svc.verifyAccessToken(token), /expired/i);
});
(0, node_test_1.default)("rejects a malformed token", () => {
    const svc = makeService();
    strict_1.default.throws(() => svc.verifyAccessToken("not-a-jwt"));
    strict_1.default.throws(() => svc.verifyAccessToken("a.b"));
});
(0, node_test_1.default)("rejects tokens from a different issuer or audience", () => {
    const svc = makeService();
    const wrongIssuer = makeService({ issuer: "someone-else" });
    const wrongAudience = makeService({ audience: "someone-else-clients" });
    const t1 = wrongIssuer.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
    const t2 = wrongAudience.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
    strict_1.default.throws(() => svc.verifyAccessToken(t1));
    strict_1.default.throws(() => svc.verifyAccessToken(t2));
});
(0, node_test_1.default)("generateOpaqueToken produces high-entropy, unique, hex tokens", () => {
    const svc = makeService();
    const a = svc.generateOpaqueToken();
    const b = svc.generateOpaqueToken();
    strict_1.default.equal(a.length, 64);
    strict_1.default.match(a, /^[0-9a-f]{64}$/);
    strict_1.default.notEqual(a, b);
});
(0, node_test_1.default)("hashOpaqueToken is deterministic and secret-dependent", () => {
    const svc = makeService();
    const other = makeService({ secret: "different-secret" });
    const token = svc.generateOpaqueToken();
    strict_1.default.equal(svc.hashOpaqueToken(token), svc.hashOpaqueToken(token));
    strict_1.default.notEqual(svc.hashOpaqueToken(token), other.hashOpaqueToken(token));
});
