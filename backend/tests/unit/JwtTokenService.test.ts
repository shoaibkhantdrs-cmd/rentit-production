import test from "node:test";
import assert from "node:assert/strict";
import { JwtTokenService } from "@/infrastructure/security/JwtTokenService";

function makeService(overrides: Partial<ConstructorParameters<typeof JwtTokenService>[0]> = {}) {
  return new JwtTokenService({
    secret: "unit-test-secret",
    issuer: "rentit",
    audience: "rentit-clients",
    accessTokenTtlSeconds: 900,
    ...overrides,
  });
}

test("signs and verifies a token round-trip", () => {
  const svc = makeService();
  const token = svc.signAccessToken({ sub: "user-1", roles: ["customer"], sessionId: "session-1" });
  const claims = svc.verifyAccessToken(token);

  assert.equal(claims.sub, "user-1");
  assert.deepEqual(claims.roles, ["customer"]);
  assert.equal(claims.sessionId, "session-1");
  assert.ok(claims.exp > claims.iat);
});

test("produces a real three-part base64url JWT", () => {
  const svc = makeService();
  const token = svc.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  for (const part of parts) {
    assert.doesNotMatch(part, /[+/=]/, "must be base64url, not base64");
  }
});

test("rejects a token signed with a different secret", () => {
  const svc = makeService();
  const other = makeService({ secret: "different-secret" });
  const token = other.signAccessToken({ sub: "u", roles: [], sessionId: "s" });

  assert.throws(() => svc.verifyAccessToken(token), /Invalid access token signature/);
});

test("rejects a tampered payload even if the signature format is otherwise valid", () => {
  const svc = makeService();
  const token = svc.signAccessToken({ sub: "u", roles: ["customer"], sessionId: "s" });
  const [header, payload, signature] = token.split(".");

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, roles: ["super_admin"] })).toString(
    "base64url",
  );

  assert.throws(() => svc.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`));
});

test("rejects an expired token", () => {
  const svc = makeService({ accessTokenTtlSeconds: -1 });
  const token = svc.signAccessToken({ sub: "u", roles: [], sessionId: "s" });

  assert.throws(() => svc.verifyAccessToken(token), /expired/i);
});

test("rejects a malformed token", () => {
  const svc = makeService();
  assert.throws(() => svc.verifyAccessToken("not-a-jwt"));
  assert.throws(() => svc.verifyAccessToken("a.b"));
});

test("rejects tokens from a different issuer or audience", () => {
  const svc = makeService();
  const wrongIssuer = makeService({ issuer: "someone-else" });
  const wrongAudience = makeService({ audience: "someone-else-clients" });

  const t1 = wrongIssuer.signAccessToken({ sub: "u", roles: [], sessionId: "s" });
  const t2 = wrongAudience.signAccessToken({ sub: "u", roles: [], sessionId: "s" });

  assert.throws(() => svc.verifyAccessToken(t1));
  assert.throws(() => svc.verifyAccessToken(t2));
});

test("generateOpaqueToken produces high-entropy, unique, hex tokens", () => {
  const svc = makeService();
  const a = svc.generateOpaqueToken();
  const b = svc.generateOpaqueToken();

  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("hashOpaqueToken is deterministic and secret-dependent", () => {
  const svc = makeService();
  const other = makeService({ secret: "different-secret" });
  const token = svc.generateOpaqueToken();

  assert.equal(svc.hashOpaqueToken(token), svc.hashOpaqueToken(token));
  assert.notEqual(svc.hashOpaqueToken(token), other.hashOpaqueToken(token));
});
