# Phase 6 Part 2 — Production Security Audit

Scope: the full system, with particular attention to the new payment surface added in Part 1 (highest-risk new code — it moves money and adds two unauthenticated public endpoints). The baseline application security review from the earlier Phase 6 audit (`docs/phase-6-audit.md`) still applies and isn't repeated here except where payments changed it.

## Authentication

Every payment endpoint except `GET /payments/config`, `GET /payments/plans`, and the two webhook receivers requires `authenticate` (JWT bearer, HS256, `timingSafeEqual`-based verification — see `JwtTokenService.ts`, unchanged from the original audit). The two public endpoints are deliberately public: config/pricing must be visible before signup, mirroring how `/properties/categories` and `/auth/*` already work.

Webhook endpoints have no user session by design — they're authenticated by HMAC signature instead (Razorpay: raw-body HMAC-SHA256 hex; Stripe: timestamped HMAC-SHA256 with replay-window checking). Both use `timingSafeEqual` with a length check first, matching the pattern already established in `JwtTokenService.ts`. Verified directly (not assumed) — see `docs/logs/phase6-part1-payment-gateway-verification.log` and `phase6-part1-webhook-signature-algorithm.log`.

**Finding: none.** No auth bypass identified on the new surface.

## Authorization

`CreateListingBoostOrderUseCase` checks `property.ownerId === userId` and throws `ForbiddenError` otherwise — a user cannot boost someone else's listing. `GetInvoiceUseCase` checks `invoice.userId === requesterId`. Admin refund/list endpoints live under `/admin`, which applies `authorize("admin", "super_admin")` at the router level (`admin.routes.ts`, `router.use(authenticate, authorize(...))`) — the same gate every other admin route uses, so a new admin route can't accidentally ship ungated.

**Finding: none new.**

## Rate limiting

**Finding (fixed):** order-creation endpoints (`POST /payments/listing-boosts`, `POST /payments/subscriptions`) had no rate limiting. Each call creates a real order against a paid external gateway API — an authenticated user hammering these could run up gateway-side quotas/costs and litter the database with abandoned pending rows. Fixed by adding `createPaymentOrderRateLimiter` (`rateLimiter.ts`), keyed by user id, 10 requests / 10 minutes by default (`RATE_LIMIT_PAYMENT_ORDER_*`), applied to both routes.

Webhook endpoints already had a dedicated IP-keyed limiter (`createWebhookRateLimiter`) added in Part 1, sized generously (120/min) since legitimate gateway redelivery bursts must never be dropped — a 429 here is safe because gateways retry on it.

## SQL injection

Every one of the 8 new repositories uses parameterized queries (`$1, $2, ...`) exclusively — confirmed by reading every `.query()` call in `PremiumPlanRepository.ts`, `PaymentOrderRepository.ts`, `PaymentRepository.ts`, `RefundRepository.ts`, `InvoiceRepository.ts`, `ListingBoostRepository.ts`, `UserSubscriptionRepository.ts`, `WebhookEventRepository.ts`. No string concatenation into SQL anywhere in the new code.

**Finding: none.**

## XSS

Backend is a JSON API; no HTML is rendered server-side. New frontend components (`PremiumPlansPage`, `PaymentHistoryPage`, `BoostListingPage`, `RazorpayCheckoutButton`, `StripeCardForm`) use React's default JSX escaping throughout — no `dangerouslySetInnerHTML`, no raw HTML injection of user- or gateway-supplied strings.

**Finding: none.**

## CSRF

This app authenticates via `Authorization: Bearer <JWT>` headers, not cookies — CSRF (which relies on browsers automatically attaching ambient credentials like cookies to cross-site requests) doesn't apply to the authenticated payment endpoints. The two webhook endpoints are unauthenticated by design and rely on signature verification, not session state, so CSRF is not a relevant threat model for them either (there's no ambient credential for a forged cross-site request to ride on).

**Finding: none.**

## SSRF

`createOrder`/`createRefund` in both gateway classes construct requests against hardcoded gateway hostnames (`api.razorpay.com`, `api.stripe.com`) — no part of that URL is user-controlled. No new SSRF surface introduced.

**Finding: none.**

## CORS

Unchanged: `cors({ origin: env.corsOrigin })`, a single configurable allowed origin (no `*`, no reflected-origin logic). Webhook endpoints are server-to-server (the gateway's servers calling ours directly, not a browser), so CORS doesn't apply to — and doesn't need to allow — them.

**Finding: none.**

## Secrets

`RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, and both webhook secrets are read from env only, never logged, never returned in any API response. The one place secrets-adjacent data reaches the client is `GET /payments/config`, which deliberately returns only the *public* key/publishable key pair — verified by reading `PaymentController.config` and `PaymentPublicConfig`'s two fields.

Webhook payloads are stored verbatim in `webhook_events.payload` and `payments.raw_event` for audit/debugging. This is safe: both gateways' webhook payloads never include full card numbers (PCI DSS requires masking to last4), only metadata (payment id, amount, method, status) — confirmed against the fields this code actually reads (`method`, no PAN field referenced or stored).

Error responses: a raw gateway API failure (e.g. Razorpay returning a 4xx) throws a plain `Error`, which the existing generic error handler (`errorHandler.ts`) maps to a 500 with a generic `"Something went wrong"` message in production (only showing `err.message` when `NODE_ENV !== production`) — this pre-existing behavior correctly prevents gateway error details from leaking to end users in production, and required no change.

**Finding: none new.**

## OWASP Top 10 (2021) — pass over categories not covered above

- **A01 Broken Access Control** — covered under Authorization above.
- **A02 Cryptographic Failures** — HMAC-SHA256 via Node's `crypto`, `timingSafeEqual` comparisons throughout; no custom/weak crypto introduced.
- **A03 Injection** — covered under SQL injection above; no shell/command execution anywhere in the payment code.
- **A04 Insecure Design** — webhook idempotency (`webhook_events` unique `(gateway, event_id)` constraint) prevents double-crediting from redelivered events; payment_order status transitions are one-directional (`created → paid/failed`), preventing a stale webhook from reverting a completed purchase.
- **A05 Security Misconfiguration** — `helmet()` is applied globally (includes a default Content-Security-Policy, `X-Content-Type-Options`, etc.); no new middleware disables any of it.
- **A06 Vulnerable Components** — no new npm dependencies were added for payments (both gateways integrate via `fetch` against their REST APIs directly, the same pattern already used for WhatsApp/Twilio/FCM), so this doesn't expand the dependency-vulnerability surface at all.
- **A07 Identification & Authentication Failures** — covered above.
- **A08 Software & Data Integrity Failures** — webhook signature verification is exactly this control: it guarantees the payment confirmation actually came from the gateway and the payload wasn't tampered with in transit.
- **A09 Security Logging & Monitoring Failures** — webhook processing failures are logged via the structured `logger.error` (Part 4 extends this further); `webhook_events.error` persists the failure reason per-event for later investigation, not just in transient logs.
- **A10 SSRF** — covered above.

## Real bug found and fixed during this pass (correctness + financial-integrity issue)

`AdminRefundPaymentUseCase` originally validated a refund amount against the payment's *original* amount (`amount > payment.amount`), not the amount *still refundable*. A payment already partially refunded could be over-refunded — e.g. a ₹1,000 payment with ₹600 already refunded would still accept a second ₹900 refund request (₹1,500 total against a ₹1,000 charge). Fixed by summing existing `processed` refunds and validating against the remaining balance instead. See the use-case file's inline comment for detail.

## Summary

| Category | Result |
|---|---|
| Authentication | Pass |
| Authorization | Pass |
| Rate limiting | 1 gap found and fixed |
| SQL injection | Pass |
| XSS | Pass |
| CSRF | Pass (not applicable — bearer-token auth) |
| SSRF | Pass |
| CORS | Pass |
| Secrets | Pass |
| OWASP Top 10 | Pass, one design note (A04) documented above |
| Financial correctness | 1 real bug found and fixed (over-refund) |
