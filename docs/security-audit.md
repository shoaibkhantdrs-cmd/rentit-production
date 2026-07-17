# RentIt — Security Audit / Vulnerability Report

Senior-engineer read-only audit across authentication, JWT, uploads, payments, API authorization, XSS, CSRF, SSRF, SQL injection, rate limiting, and HTTP headers. No code was modified. The two highest-severity findings were independently re-verified against the actual source below (not just taken from sub-audit output): the JWT secret fallback in `env.ts`, and the property-owner self-publish authorization gap in `UpdateProperty.usecase.ts`. Both are confirmed accurate.

## Severity summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 2 |
| Medium | 6 |
| Low | 3 |
| Informational (confirmed secure — see bottom section) | many |

## Findings, ranked by severity

### 1. CRITICAL — JWT signing secret silently falls back to a hardcoded, source-visible value unless `NODE_ENV` is exactly `"production"`

`backend/src/config/env.ts:23-28, 56` — independently verified.

```ts
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

if (isProduction && !process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be set in production");
}
...
accessSecret: required("JWT_ACCESS_SECRET", "dev-only-insecure-secret-change-me"),
```

The startup guard only fires on an exact match to the string `"production"`. If a real deployment leaves `NODE_ENV` unset, or sets it to anything else (`staging`, a typo, a platform that doesn't propagate the variable into the container — all common in practice), `isProduction` is `false`, the guard never runs, and the app silently signs and verifies every access token with the hardcoded fallback secret `dev-only-insecure-secret-change-me`, which is committed in source.

**Attack:** anyone who reads this file (or simply tries the well-known fallback string against a live instance) can forge a valid HS256 access token for any user ID and any role, including `admin`/`super_admin` — full authentication bypass and account takeover, no credentials needed.

**Fix direction:** require `JWT_ACCESS_SECRET` whenever `NODE_ENV !== "development"` (fail closed on anything ambiguous), not only when it's exactly `"production"`.

### 2. HIGH — Property owners can self-publish and self-unhide listings, bypassing admin moderation entirely

`backend/src/interfaces/http/validators/property.schemas.ts:27,67` and `backend/src/application/properties/UpdateProperty.usecase.ts:61-100` — independently verified.

The owner-facing `PATCH /properties/:id` schema accepts a `status` field with the full status enum, including `"published"` and `"inactive"`. The use case's only authorization check is `assertOwnerOrAdmin(existing, input.requesterId, input.requesterRoles)` (line 67) — there is no additional restriction on which roles may set which status values. Any status change, including to `"published"`, is applied unconditionally at lines 94-100.

**Attack:** a `property_owner` account creates a listing (starts `pending_review`), then immediately calls `PATCH /properties/:id { "status": "published" }` — the listing goes live having never been reviewed. If an admin hides a listing for a policy violation (`status → inactive`), the owner can simply `PATCH` it back to `"published"`, completely undermining the moderation action.

**Fix direction:** restrict which status transitions a non-admin caller may make (e.g. owners can move `draft → pending_review` or set `inactive` on their own listing, but only admin-role callers can set `published` or reverse an admin-applied `inactive`).

### 3. MEDIUM — OTP codes are written to plaintext application logs if SMTP/SMS credentials are left unconfigured

`backend/src/infrastructure/email/ConsoleEmailService.ts:9-13`, `backend/src/infrastructure/sms/ConsoleSmsService.ts:4-8`, `backend/src/container.ts:288-291`

The app falls back to a console-logging email/SMS provider whenever `SMTP_HOST`/`TWILIO_ACCOUNT_SID` aren't set — with no startup guard forcing real providers in production (unlike the JWT secret, which at least *attempts* one). The OTP is embedded in a free-text log message (`` `[dev-email] Your code to ... is ${code}` ``), which the logger's field-based redaction (it censors structured fields named `password`/`code`/etc., not substrings inside a message string) does not catch. If this misconfiguration occurs, every login/registration OTP is readable by anyone with log access.

### 4. MEDIUM — Payment webhook secrets have no production-startup guard

`backend/src/config/env.ts:128-138`, `backend/src/infrastructure/payments/RazorpayPaymentGateway.ts:70-81`, `StripePaymentGateway.ts:87-111`

`RAZORPAY_WEBHOOK_SECRET`/`STRIPE_WEBHOOK_SECRET` default to `""` with no equivalent of the JWT secret's `isProduction` guard. If left unset in production, webhook signature verification becomes `HMAC-SHA256(rawBody, "")` — a key anyone can compute — letting an attacker forge a `payment.captured` webhook for a real (unpaid) order they created, marking it paid and activating a boost/plan for free. The signature-verification *logic itself* (raw-body capture, HMAC, timing-safe compare, Stripe's replay-window check) is correctly implemented; this is purely a missing fail-closed default for the secret's presence.

### 5. MEDIUM — Identity verification documents (government ID photos) are stored on public, unauthenticated Cloudinary URLs

`backend/src/infrastructure/storage/CloudinaryImageStorageService.ts:32-60`, `backend/src/application/verification/SubmitIdentityVerification.usecase.ts:23-38`

Uploads use Cloudinary's default `type: "upload"` (public delivery), not `type: "authenticated"`/signed URLs. Application-level authorization on *who can retrieve the URL through the API* is correctly enforced, but the raw Cloudinary URL itself requires no authentication once known — if it ever leaks (logs, browser history, a shared screenshot, a compromised admin session), anyone with the link can view the ID document indefinitely. Not directly enumerable (the `public_id` is random), but a real defense-in-depth gap for a highly sensitive PII category.

### 6. MEDIUM — In-memory rate limiter doesn't survive restarts or scale across instances

`backend/src/interfaces/http/middleware/rateLimiter.ts:1-33`

No `store` option is configured, so `express-rate-limit` uses its default in-process `Map` (already flagged in the code's own comment as a known gap). In any horizontally-scaled or frequently-redeployed production deployment, an attacker distributing requests across instances gets effectively `max × N-instances` attempts per window, and every restart resets the counters to zero.

### 7. MEDIUM — Admin-only high-impact endpoints have no rate limiting

`backend/src/interfaces/http/routes/admin.routes.ts` (entire file)

Bulk property moderation (up to 100 at once), role changes, user bans, and refunds have zero request throttling beyond the router-level `authenticate + authorize("admin","super_admin")` check. Requires an already-compromised admin credential to exploit, but removes a standard defense-in-depth layer from the highest-blast-radius part of the API (money movement, mass content/account changes) within a stolen token's short-lived window.

### 8. MEDIUM — `updateUserRolesSchema` has no allowlist at the validator layer (defense-in-depth gap, not currently exploitable)

`backend/src/interfaces/http/validators/admin.schemas.ts:35-37`

The schema accepts any string 1-50 characters as a role name; the real protection (blocking `super_admin` grants from non-`super_admin` actors, rejecting unknown role names) lives entirely in `UpdateUserRoles.usecase.ts`, confirmed present and correct. Not exploitable as currently wired, but if any future code path reuses this schema without routing through that exact use case, there'd be nothing stopping it. Recommend `z.enum([...])` of known role names at the schema layer.

### 9. LOW — `/auth/refresh` has no rate limiting

`backend/src/interfaces/http/routes/auth.routes.ts:39` — every other sensitive auth route (`register`, `login`, `verify-otp`, `forgot-password`, `reset-password`) has `authRateLimiter` applied; `refresh` and `logout` don't. Refresh tokens are 256-bit random values (not brute-forceable), so this isn't a credential-guessing risk — it's an unauthenticated, DB-write-triggering endpoint with no throttle, a plausible DoS/resource-exhaustion target.

### 10. LOW — Account enumeration via `/auth/register`

`backend/src/application/auth/RegisterUser.usecase.ts:40-50` — returns a distinct "email/phone already registered" error, unlike `LoginUser`/`ForgotPassword`, which are both deliberately written to avoid revealing account existence. Common/expected UX for registration flows; flagged only for inconsistency with the enumeration-resistant design used everywhere else.

### 11. LOW / INFORMATIONAL — File uploads validate MIME type only from client-supplied headers, no magic-byte check

`backend/src/interfaces/http/middleware/imageUpload.ts:6,19-25` — `file.mimetype` is attacker-controllable in principle. Mitigated in practice: SVG (the classic embedded-`<script>` vector) is not in the allowlist (only JPEG/PNG/WebP), and every upload is re-encoded by Cloudinary server-side, which would reject a non-image byte stream regardless of its claimed type. Recommend an explicit magic-byte check (e.g. the `file-type` package) as defense-in-depth rather than relying on a third party's behavior.

### 12. LOW / INFORMATIONAL — Dev-login backdoor is correctly gated, but shares a root cause with Finding #1

`backend/src/interfaces/http/routes/auth.routes.ts:59-67`, `container.ts:391-409`, `DevAutoLogin.usecase.ts:44-92` — three independent, correctly-implemented layers all gate on `nodeEnv === "development"` exactly, and the reachable account is a fixed non-admin seeded demo user with no arbitrary-user parameter. Low as currently coded. Worth flagging: if `NODE_ENV` is simply left unset (defaults to `"development"`), this route *does* become live in what was intended to be a production deployment — the same single misconfiguration underlying Finding #1.

---

## Confirmed secure (explicitly checked, no issue found)

- **JWT algorithm confusion / `alg:none`**: not exploitable — `JwtTokenService.verifyAccessToken` is a hand-rolled verifier that never branches on the token's own header; it unconditionally recomputes the HMAC and compares with `timingSafeEqual`.
- **Refresh-token rotation and reuse detection**: correctly implemented — replaying an already-rotated refresh token revokes the entire token family and the session, forcing re-login.
- **Refresh tokens stored hashed, not plaintext**; **OTPs generated via CSPRNG** (`node:crypto.randomInt`, not `Math.random`); **OTP verification has both TTL and a DB-backed max-attempts counter**, independent of the HTTP rate limiter; **bcrypt cost factor 12**, within the recommended range.
- **Login / OTP-request / forgot-password flows are enumeration-resistant by design** (explicit code comments confirm this is intentional).
- **`logout-all` revokes real server-side state**, not just client-side token deletion.
- **Payment amounts are always server-derived** — the order-creation request schemas don't even accept an `amount` field from the client.
- **Webhook idempotency** is correctly enforced at two independent layers (unique-constraint event-ID insert, plus an order-status check).
- **Refund authorization** is admin-only, and over-refund is correctly prevented by netting out prior refunds before computing the ceiling.
- **File size limits are enforced server-side** (multer, byte-counted, not client-`Content-Length`-trusted); **no path traversal** — no user-controlled filename/string ever reaches a storage path or Cloudinary `public_id`.
- **No hardcoded payment credentials** anywhere outside test fixtures.
- **IDOR**: traced ownership/participant checks for every resource-scoped route (properties, conversations, saved searches, invoices, notifications, verification docs, admin user actions) — all correctly scoped server-side to the authenticated requester or admin role.
- **CORS**: explicit origin allowlist (not wildcard/reflect-any-origin), `credentials` not enabled.
- **CSRF**: not applicable by design — auth is Bearer-token-only, confirmed zero cookie usage anywhere in the backend.
- **Security headers**: `helmet()` is applied with its full default set (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.).
- **Mass assignment**: the validation middleware replaces (not merges) the request body with the parsed schema output, so undeclared fields never reach a use case.
- **Error handler**: no stack traces or internal details leak to clients in production.
- **No GET-based state-changing routes** found anywhere.
- **XSS**: zero `dangerouslySetInnerHTML`/`innerHTML =`/`document.write` in the frontend; all user-generated text goes through React's auto-escaping JSX interpolation; no user-controlled URL field exists anywhere that could carry a `javascript:` URI.
- **SSRF**: every outbound request (geocoding, WhatsApp API) uses a hardcoded host with user input only ever placed in a query-parameter value; no "upload by URL" or link-preview feature exists anywhere that could be pointed at an internal/metadata endpoint.
- **SQL injection**: every dynamic query-builder (property search, admin property search, growth analytics, per-table update patchers) uses either bound `$N` parameters for values or a hardcoded lookup table for column/sort selection — confirmed no string-concatenation of user input into SQL text anywhere in the repository layer.

## Suggested remediation order

1. Fix the `NODE_ENV` exact-match guard in `env.ts` — this single change closes both Finding #1 (JWT secret) and neutralizes the realistic failure mode behind Finding #12 (dev-login). Highest leverage, lowest effort.
2. Restrict the property `status` field on the owner-facing update endpoint so only admin-role callers can set `published`/reverse a hide (Finding #2).
3. Add the same production-required guard used for `JWT_ACCESS_SECRET` to the Razorpay/Stripe webhook secrets (Finding #4).
4. Move a Redis-backed (or equivalent shared) store into the rate limiter, and extend it to `/auth/refresh` and the `/admin/*` routes (Findings #6, #7, #9).
5. Switch identity-verification document delivery to Cloudinary's authenticated/signed URLs (Finding #5).
