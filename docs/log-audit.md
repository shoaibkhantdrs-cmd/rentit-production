# RentIt — Logging Audit

Read-only audit of every logging call site in the codebase (backend `logger.*`, backend `console.*`, frontend `console.*`), checked against seven sensitive-data categories: passwords, OTP, JWT, refresh tokens, payment IDs, card data, authorization headers. Nothing was fixed or removed — findings only.

## Bottom line

Two of the seven categories are confirmed leaking into logs today: **OTP codes** (email and SMS channels) and **payment/order IDs** (one webhook failure path). The other five — passwords, JWT, refresh tokens, card data, authorization headers — were not found in any log line anywhere in the codebase. Card data was never in scope to begin with (no PAN/CVV ever reaches this backend, confirmed in the prior security audit). One structural gap is worth fixing regardless of whether it's firing today: two `console.error` calls in `database.ts` bypass pino's redact config entirely.

## Logger inventory

`backend/src/infrastructure/logging/logger.ts` is the single pino instance used everywhere (`pino-http` creates per-request child loggers that inherit it). Its redact config:

```
paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.newPassword", "*.code", "*.refreshToken", "*.accessToken"]
censor: "[REDACTED]"
```

This protects those exact field names **one level deep** in a structured object passed as a log call's first argument. It does **not** protect: values embedded in the free-text message string (second argument), fields nested two or more levels deep, or anything logged via raw `console.*` instead of `logger.*` (console calls never pass through pino at all).

24 total call sites audited: 20 `logger.*` calls in `backend/src`, 2 `console.error` calls in `backend/src/config/database.ts`, 2 `console.warn` calls in `frontend/src`.

## Confirmed findings

### 1. OTP codes — leaked, via message-string interpolation (2 channels)

| File:line | Code |
|---|---|
| `backend/src/infrastructure/sms/ConsoleSmsService.ts:6` | `logger.info({ to }, \`[dev-sms] ${body}\`)` |
| `backend/src/infrastructure/email/ConsoleEmailService.ts` (flagged in the prior security audit) | same pattern |

`body` carries the literal OTP code as free text. Pino's redact only scans the structured first argument (`{ to }`); the OTP is embedded in the second (message) argument, which is never scanned. The `*.code` redact rule exists but never gets a chance to match, because the code isn't in a field called `code` — it's baked into a string. These are the dev/console fallback providers, used whenever `TWILIO_*`/`SMTP_*` env vars are unset (the current local `.env` state — both are blank), so this fires on every OTP send in the current configuration.

`ConsoleWhatsAppService.ts:6-9` has the identical structural pattern (`` `[dev-whatsapp] ${message.template}(${message.params.join(", ")})` ``), but tracing its three callers (`ShareProperty.usecase.ts`, `ContactOwner.usecase.ts`, `SendInquiry.usecase.ts`) confirms none of them ever pass an OTP or other secret as a template param — only property titles, URLs, requester names, and inquiry text. Same vulnerability shape, not currently triggered because no caller feeds it sensitive data.

### 2. Payment/order IDs — leaked, via error-message interpolation (1 path)

`backend/src/application/payments/HandlePaymentWebhook.usecase.ts:75-78`:

```ts
this.logger.error(
  { gateway: this.gateway.name, eventId: event.eventId, error: message },
  "Webhook processing failed",
);
```

`message` is `err.message`, and two thrown errors upstream embed real gateway identifiers by string interpolation:

```ts
// line 116
throw new Error(`No payment_order found for gateway order ${event.gatewayOrderId}`);
// line 169
throw new Error(`No payment found for gateway payment ${event.gatewayPaymentId}`);
```

So a real Razorpay/Stripe `gatewayOrderId`/`gatewayPaymentId` ends up in the `error` field of the logged object whenever a webhook references an order/payment record the backend doesn't recognize. Not card data (no PAN/CVV involved anywhere in this flow), but a genuine payment identifier written to logs. No other payment/gateway file (`RazorpayPaymentGateway.ts`, `StripePaymentGateway.ts`, `AdminRefundPayment.usecase.ts`, etc.) has any logging call at all — confirmed by a repo-wide grep scoped to `*Payment*.ts`.

## Structural gap (not currently firing, but worth closing)

`backend/src/config/database.ts:17,25`:

```ts
console.error("Unexpected PostgreSQL client error", err);
console.error("Database connection check failed", err);
```

These are raw `console.error`, not `logger.error` — they never pass through pino at all, so the redact config has zero effect on them regardless of what `err` contains. In the current `pg` error shapes seen here (connection-refused / query-failure errors), `err.message` doesn't embed the connection string or password. But this is the one place in the codebase where a logging call has **no redaction safety net by construction** — if a future `pg` error variant ever attached the connection string (which itself contains `DATABASE_URL`'s embedded password, e.g. `rentit_dev_password`) to `err`, it would print in full. Recommend switching both calls to the shared `logger` instance for consistency and redaction coverage, independent of whether it's exploitable today.

## Confirmed clean (checked, nothing found)

- **Passwords** — never appear in any log call. The only place a password-shaped value could reach a logger is via a `ValidationError`'s `details` (zod's `.flatten()` output on a failed registration/login schema), and `errorHandler.ts:34-36` only logs `{ requestId, code }, err.message` for 4xx `AppError`s — `details` itself is never passed to the logger, only returned in the HTTP response body (which is the intended behavior, not a log leak).
- **JWT / access tokens** — `JwtTokenService.ts`'s seven failure paths all throw `UnauthorizedError` with static messages ("Malformed access token", "Access token expired", "Invalid access token signature", etc.) — none interpolate the raw token. `WebSocketGateway.ts`'s token verification (`handleUpgrade`, line 100-106) catches and discards the error entirely with no logger call at all before returning 401. The three `logger.warn({ err }, ...)` calls in `WebSocketGateway.ts` (upgrade failures, malformed frames, unparseable messages) only ever wrap framing/parsing errors, never the token-verification path.
- **Refresh tokens** — `RefreshToken.usecase.ts`'s two failure throws ("Invalid refresh token", "Refresh token expired...") are static strings; the token value itself is never interpolated or logged anywhere.
- **Card data** — not applicable; confirmed in the prior security/payments audits that no PAN/CVV/cardholder data ever reaches this backend (Razorpay/Stripe handle card capture client-side).
- **Authorization headers** — `req.headers.authorization` and `req.headers.cookie` are explicitly in the pino redact list and are the exact shape `pino-http`'s default request serializer produces, so the per-request child logger redacts them on every auto-logged request line. No application code logs `req.headers` directly anywhere (confirmed via the same 20-site inventory — none of the call sites touch headers except through the inherited child-logger serializer).
- **`errorHandler.ts`'s 5xx path** (`logger.error({ err, requestId }, err.message)`, lines 26 and 60) — pino's default error serializer surfaces `err.message`, `err.stack`, and `err`'s own enumerable properties (`statusCode`, `code`, `details` for an `AppError`). Traced every `AppError` subclass (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`) — the only one that sets `details` is `ValidationError`, which is always a 4xx and never reaches this 5xx branch. No 5xx `AppError` in this codebase carries a `details` payload, so there's nothing sensitive in the deep-nested-field redaction gap discussed in this audit's earlier analysis — flagged as informational since the gap is structural (would matter if a future `AppError` subclass added sensitive `details` at 5xx), not currently exploitable.
- **`SentryErrorTracker.ts` / `NoOpErrorTracker.ts`** — Sentry's payload builder only forwards `error.name`, `error.message`, `error.stack`, and the explicit `context` fields (`requestId`, `route`, `method`, `statusCode`, `userId`) — never the full `err` object, so no risk of a stray enumerable property leaking here even if one existed. `NoOpErrorTracker` re-logs through the same `logger.error({ err, ...context }, ...)` pattern already covered above.
- **`FcmPushNotificationService.ts:114`** (`logger.warn({ status, body }, "FCM send failed...")`) — `body` is FCM's own HTTP error response text, not user data; the `Authorization: Bearer ${accessToken}` header used two lines above is never logged, only sent as a request header.
- **`ConsolePushNotificationService.ts` / `ConsoleNotificationSender.ts`** — both log `userId`/`channel`/`to`/`subject` as structured fields and the notification body as free text, but nothing in either flow's call chain feeds them a password/OTP/token — they carry generic notification/message content only.
- **`server.ts`'s four calls** and **`SentryErrorTracker.ts`'s DSN-parsing** — startup/shutdown messages and a `sendError`/`originalError.message` warn on Sentry delivery failure; none reference credentials.
- **Frontend** — only 2 `console.*` calls in all of `frontend/src`: `registerServiceWorker.ts:19` (`console.warn("Service worker registration failed:", err)`, generic SW error) and `AuthContext.tsx:68` (`console.warn("Dev auto-login skipped:", err)`, a dev-only/`import.meta.env.DEV`-gated auto-login network error — the `.catch()` branch never has access to `accessToken`/`refreshToken`, which are only read in the `.then()` success branch). Neither logs a credential.

## Recommended fixes, ranked

1. Move the OTP value out of the message-string in `ConsoleSmsService.ts` and `ConsoleEmailService.ts` (and preemptively `ConsoleWhatsAppService.ts`, since it's one caller-change away from the same leak) — log a static message like `"[dev-sms] OTP sent"` and pass the OTP itself under a field literally named `code` (or omit it from the log entirely), so the existing `*.code` redact rule actually applies.
2. In `HandlePaymentWebhook.usecase.ts`, stop putting the raw thrown-error message into the logged `error` field when it embeds a gateway order/payment ID — log the IDs as separate structured fields (which is already partially redactable/controllable) or truncate/hash them, rather than free-texting them into an `Error` that then gets logged verbatim.
3. Switch `database.ts`'s two `console.error` calls to the shared `logger` instance, purely for consistency and redaction coverage — not urgent given today's error shapes, but removes the one logging call site in the codebase with zero redaction safety net.
