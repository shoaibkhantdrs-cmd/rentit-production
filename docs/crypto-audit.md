# RentIt — Cryptography Audit

Read-only, repository-wide search for every `crypto` / `randomBytes` / `createHash` / `createHmac` / `pbkdf2` / `bcrypt` / `jwt` usage (backend `src` + `tests`; `node_modules` excluded), plus an explicit search for known-weak algorithms (MD5, SHA-1, `Math.random`, DES, RC4, ECB). Nothing was fixed or modified — findings only.

## Bottom line

Every cryptographic primitive in production code (`backend/src`) is used correctly: bcrypt for password hashing at a proper cost factor, a CSPRNG (`crypto.randomInt`/`randomBytes`) everywhere randomness needs to be unguessable, HMAC-SHA256 with `timingSafeEqual` for every signature check (JWTs and both payment-gateway webhooks), and RSA-SHA256 for the one place RSA signing is needed (Google's FCM OAuth2 service-account exchange). No MD5, DES, RC4, or ECB usage exists anywhere in the repository. The only SHA-1 usage in the entire codebase is mandated by the WebSocket protocol spec itself, not a security decision. The only `Math.random()` usage is in test fixtures, never in production code, and the codebase has an explicit code comment calling out why it deliberately avoids `Math.random()` for anything real.

## 1. Password hashing — `BcryptHasher.ts` — secure

```ts
// backend/src/infrastructure/security/BcryptHasher.ts
async hash(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, this.saltRounds);
}
async verify(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
```

`saltRounds` is injected from `BCRYPT_SALT_ROUNDS` (`backend/.env:18` = `12`) — within OWASP's recommended 10-12+ range for bcrypt in 2025/2026. Verification uses `bcrypt.compare`, which is constant-time by construction (bcrypt's own design), not a manual string comparison. No hardcoded/weak cost factor found anywhere.

## 2. JWT (access tokens) — `JwtTokenService.ts` — secure, hand-rolled HS256

This project deliberately doesn't depend on the `jsonwebtoken` npm package (confirmed absent from `package.json` in the prior dependency audit); it hand-rolls a real, spec-compliant HS256 JWT using only Node's built-in `crypto`:

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
...
private sign(data: string): string {
  return base64url(createHmac("sha256", this.config.secret).update(data).digest());
}
```

Verification (`verifyAccessToken`, lines 60-97):
- Recomputes the expected signature independently rather than trusting anything in the token's own header — the `alg` field is never read back from the incoming token, so this implementation is **immune to the classic "alg: none" / algorithm-confusion JWT attack class** (there's no code path where an attacker-supplied `alg` value changes what verification logic runs; it's always HMAC-SHA256 against the server's own secret).
- Compares signatures with `timingSafeEqual`, and explicitly checks buffer length equality first (line 74) before calling it — `timingSafeEqual` throws on length mismatch rather than returning `false`, and the length check turns that into a clean 401 instead of an unhandled 500. Correct, deliberate handling of a real Node `crypto` API gotcha.
- Independently validates `exp`, `iss`, and `aud` after signature verification, all against server-side config, not attacker-controlled values.

One structural note: the signing secret is `env.jwt.accessSecret`, which per the earlier secrets audit has a hardcoded dev-only fallback (`dev-only-insecure-secret-change-me` in `backend/src/config/env.ts:56`) if `JWT_ACCESS_SECRET` isn't set. That's an environment-configuration risk (already flagged as Critical Finding #1 in `docs/security-audit.md`), not a flaw in the cryptographic *algorithm* itself — HMAC-SHA256 is a correct, secure choice; the risk is entirely in what key value ends up in it if the operator never overrides the default.

## 3. Refresh tokens — opaque + HMAC-hashed at rest — secure

```ts
generateOpaqueToken(): string {
  return randomBytes(32).toString("hex"); // 256 bits of entropy
}
hashOpaqueToken(token: string): string {
  return createHmac("sha256", this.config.secret).update(token).digest("hex");
}
```

Refresh tokens are intentionally **not** JWTs (so they can be revoked server-side before natural expiry). They're 256-bit CSPRNG values, and only the HMAC-SHA256 hash of the token is ever stored in the database (`RefreshToken.usecase.ts`, `SessionIssuer.ts`) — the raw token is returned to the client once and never persisted. Lookup is by exact hash match (`findByTokenHash`), which is the correct pattern for an unguessable 256-bit value; a hash lookup doesn't need `timingSafeEqual` protection the way a shared-secret comparison would, since the security property here comes from the token's entropy, not from hiding a fixed comparison. `RefreshToken.usecase.ts` also implements proper **rotation + reuse detection**: every refresh both issues a new token and revokes the old one, and replaying an already-rotated (revoked) token triggers revocation of the entire token family plus the session, exactly the mitigation OWASP recommends against stolen-refresh-token replay.

## 4. Payment webhook signature verification — `StripePaymentGateway.ts` / `RazorpayPaymentGateway.ts` — secure

Both gateways verify inbound webhook signatures identically:

```ts
const expected = createHmac("sha256", this.config.webhookSecret).update(rawBody /* or signedPayload */).digest("hex");
```

paired with `timingSafeEqual` for the actual comparison (imported alongside `createHmac` in both files) — the correct pattern for verifying an HMAC-signed webhook, matching each provider's documented signature scheme (Stripe's `v1=` HMAC-SHA256 over `timestamp.payload`, Razorpay's HMAC-SHA256 over the raw body). Both are exercised by real unit tests (`StripePaymentGateway.test.ts`, `RazorpayPaymentGateway.test.ts`) that independently recompute the same HMAC to build valid test fixtures.

## 5. OTP generation — `CryptoOtpGenerator.ts` — secure, and explicitly documented as such

```ts
import { randomInt } from "node:crypto";
generate(length: number): string {
  const max = 10 ** length;
  const value = randomInt(0, max); // cryptographically strong, unlike Math.random()
}
```

Uses `crypto.randomInt`, a CSPRNG-backed uniform integer generator — not `Math.random()` (which is not cryptographically secure and is predictable/seedable). The inline comment shows this was a deliberate choice, not an oversight.

## 6. FCM push notifications — `FcmPushNotificationService.ts` — secure, correct use of RSA

Implements Google's service-account JWT-bearer OAuth2 flow by hand (no `firebase-admin` SDK dependency, same "no npm registry access" constraint as elsewhere in this project):

```ts
const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
...
const signature = createSign("RSA-SHA256").update(unsigned).sign(this.config.privateKey);
```

RS256/RSA-SHA256 is the algorithm Google's OAuth2 JWT-bearer token exchange requires for this exact flow (signing with the service account's RSA private key, verified server-side by Google using the corresponding public key) — this is the provider-mandated algorithm, not a locally-chosen one, and it's implemented correctly (proper base64url encoding, correct claim set: `iss`/`scope`/`aud`/`iat`/`exp`).

## 7. Non-cryptographic randomness — `randomUUID()` — appropriate everywhere it's used

`randomUUID()` appears in `requestId.ts` (HTTP request ID), `WebSocketGateway.ts` (in-memory connection ID), `SessionIssuer.ts` (refresh-token family ID), `SentryErrorTracker.ts` (Sentry event ID), and several test fakes (fixture entity IDs). None of these values are used as secrets, authentication tokens, or anything requiring unpredictability against a determined attacker — they're correlation/identity IDs, which is exactly what `randomUUID()` (itself CSPRNG-backed per Node's implementation, RFC 4122 v4) is designed for. No misuse found.

## 8. Weak-algorithm sweep — explicit search, findings below

Searched the full repository (`*.ts`/`*.tsx`/`*.js`) for `MD5`, `SHA1`/`SHA-1`, `Math.random`, `DES`, `RC4`, `ECB`, and legacy `createCipher()`/`createDecipher()` (the pre-IV, insecure Node crypto API superseded by `createCipheriv`).

| Pattern | Result |
|---|---|
| MD5 | **Zero matches** anywhere in the repository. |
| DES / RC4 / ECB | **Zero matches** anywhere in the repository. |
| `createCipher()` / `createDecipher()` (legacy, no-IV API) | **Zero matches.** No symmetric encryption (of any kind, weak or strong) is performed anywhere in this codebase — there's no data-at-rest encryption layer in scope here beyond bcrypt/HMAC hashing, so this isn't a gap, just worth noting for completeness. |
| SHA-1 | **Two matches, both non-security, both justified:** (1) `backend/src/infrastructure/realtime/wsFraming.ts:19` — `createHash("sha1").update(clientKey + WEBSOCKET_MAGIC).digest("base64")`, computing the `Sec-WebSocket-Accept` header value during the WebSocket handshake. **RFC 6455 §1.3 mandates SHA-1 specifically** for this exact handshake step — it's a protocol-compliance requirement, not a security control (the value isn't secret, isn't used for authentication, and an attacker knowing it grants nothing). (2) `backend/tests/unit/webSocketFraming.test.ts:97` — a test asserting that same handshake computation, same justification. No other SHA-1 usage exists; every security-relevant hash/HMAC in the codebase uses SHA-256. |
| `Math.random()` | **Four matches, all in test files, none in `backend/src` or `frontend/src`:** `tests/integration/whatsapp.test.ts:11`, `tests/integration/chat.test.ts:9-10`, `tests/integration/admin-properties.test.ts:13` — all generating throwaway unique-ish email addresses for test fixtures (`owner-${Date.now()}-${Math.random()}@example.com`), never security-relevant. Zero `Math.random()` calls exist in production code; the one place randomness needs to be unpredictable (OTP generation) explicitly uses `crypto.randomInt` instead, with an inline comment noting the choice was deliberate. |

## Everything checked with no match / no concern

`pbkdf2` and `scrypt` — not used anywhere (bcrypt covers password hashing; HMAC-SHA256 covers token hashing — neither gap is a weakness, just noting the full requested pattern list was searched and these two returned nothing). `createCipher`/legacy symmetric encryption — none present. Any hardcoded IV or ECB-mode cipher config — not applicable, no cipher usage exists to check. `jsonwebtoken` package — confirmed (again, consistent with the prior dependency audit) not a dependency; JWT handling is fully hand-rolled and reviewed above.

## Recommendation

Nothing in this audit requires a code change on cryptographic grounds — every primitive and parameter choice found is a secure, current best practice. The one related item worth acting on is already tracked elsewhere: replace the hardcoded `JWT_ACCESS_SECRET` fallback (`dev-only-insecure-secret-change-me`) with a hard failure in production if the env var is unset, per `docs/security-audit.md` Finding #1 — that's a key-management/config issue, not a defect in the HMAC-SHA256 implementation itself.
