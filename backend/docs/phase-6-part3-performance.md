# Phase 6 Part 3 — Performance Optimization

## Database indexes

All 9 new payment tables ship with indexes matching their actual query patterns (see the migrations in `db/migrations/1700000000034` through `1700000000043`): `payment_orders` on `user_id`, `status`, and `(purchasable_type, purchasable_id)`; `payments` on `payment_order_id` and `status`; `listing_boosts` with a partial index `(property_id, status, ends_at) WHERE status = 'active'` for the search-ranking lookup; `user_subscriptions` similarly partial-indexed for "does this user have an active plan."

Audited the rest of the schema for foreign keys without a covering index. Two initially flagged as suspicious (`property_reports.reporter_user_id`, `user_reports.reporter_user_id`) turned out to already be covered by each table's `UNIQUE (x, reporter_user_id)` constraint, which Postgres backs with an automatic index — verified by reading the actual migrations rather than trusting the heuristic grep that flagged them. One real gap found: `user_subscriptions.plan_id` had no index at all. Fixed in migration `1700000000043`.

## API performance

No N+1 queries in the new payment use-cases — `GetPaymentHistoryUseCase`/`AdminListPaymentsUseCase` are single paginated queries; `PaymentRepository.listForUser` does one JOIN, not a per-row lookup.

**Fixed: no response compression existed anywhere in the API.** Added a hand-rolled compression middleware (`interfaces/http/middleware/compression.ts`) using Node's built-in `zlib` (brotli preferred, gzip fallback per `Accept-Encoding`) rather than adding the `compression` npm package as a new dependency — consistent with this codebase's existing pattern of hand-rolling infrastructure (WebSocket framing, JWT, SMTP client) instead of pulling in a library for something `zlib` already does. Verified directly: a 200-item JSON sample compressed from 8,479 bytes to 662 bytes (brotli) / 1,457 bytes (gzip), with an exact round-trip decompress check — see `docs/logs/phase6-part3-compression-verification.log`.

**Fixed: no HTTP caching headers anywhere.** Added `cacheControl(seconds)` middleware, applied to `GET /payments/config` (5 min), `GET /payments/plans` (1 min), and `GET /properties/categories` (5 min) — all reference-ish data that's identical for every caller and only changes on a deploy/admin action. Never applied to anything user-specific.

## React rendering / lazy loading

**Fixed: the entire app was one JS bundle.** The `/admin` section (11 pages, only ever reached by admin/super_admin users past `AdminLayout`'s own role gate) is now code-split via `React.lazy` + `Suspense`, using a small `lazyNamed()` helper (`utils/lazyNamed.ts`) since every page in this app is a named export, not a default export (React.lazy requires a default export). Regular renter/owner users no longer download or parse the admin bundle at all.

## Image optimization

Already handled correctly before this pass — `CloudinaryImageStorageService` uploads with `{ width: 2000, height: 2000, crop: "limit" }` (never upscales) plus `{ quality: "auto", fetch_format: "auto" }` (Cloudinary serves WebP/AVIF to browsers that support it, at an automatically-chosen quality). No change needed.

## Caching (application-level)

The frontend's `httpClient` already had a small in-memory GET cache (`cacheMs` parameter, Phase 5 Part 8) for reference data. Reused as-is for `paymentsApi.config()` (5 min) and `paymentsApi.plans()` (1 min) rather than building a second caching mechanism.

## Compression

Covered above under API performance.

## Summary of real fixes made in this pass

1. No response compression → hand-rolled brotli/gzip middleware, verified with a real round-trip test.
2. No HTTP caching headers → `cacheControl` middleware on 3 reference-data endpoints.
3. Entire frontend was one bundle → admin section code-split via `React.lazy`.
4. `user_subscriptions.plan_id` had no index → added.
