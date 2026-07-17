# RentIt Database Documentation (v1.0)

PostgreSQL, managed via `node-pg-migrate` — 43 migrations in `backend/db/migrations/`, applied in filename-timestamp order via `npm run migrate:up`. There is no ORM; every repository (`backend/src/infrastructure/database/repositories/`) writes parameterized SQL directly against the `pg` driver — see `docs/phase-6-part2-security-audit.md` for confirmation every one of them is injection-safe.

## Table groups

**Identity & auth**: `users`, `roles`, `user_roles` (many-to-many), `user_devices`, `sessions`, `refresh_tokens`, `otp_codes`. Refresh tokens rotate on use; reuse of an already-rotated token revokes the whole session (see `docs/phase-2.md`).

**Notifications & preferences**: `notifications`, `user_preferences`.

**Audit & activity**: `audit_logs` (admin actions — who did what to whom), `activity_logs` (user's own actions, e.g. profile updates).

**Properties**: `property_categories`, `properties` (core listing — includes moderation status, `is_featured`, view/favorite counters), `property_locations` (address + lat/lng, one-to-one with a property), `property_images`, `property_features`, `property_views`, `property_favorites`, `property_reports`, `property_status_history` (every moderation transition, for the admin audit trail).

**Trust & safety**: `user_reports`, `identity_verifications`.

**Saved search**: `saved_searches` (a stored filter set + alert preference).

**Chat**: `conversations`, `conversation_participants`, `messages`.

**Payments** (Phase 6 Part 1): `premium_plans` (seeded: silver/gold/platinum), `payment_orders` (gateway-agnostic intent), `payments` (confirmed charge, one-to-one-ish with an order), `refunds`, `invoices`, `listing_boosts`, `user_subscriptions`, `webhook_events` (idempotency ledger — `UNIQUE(gateway, event_id)` so a redelivered webhook is a no-op, not a double-charge).

## Key relationships

`payment_orders`/`payments` use a polymorphic pair — `purchasable_type` (`'listing_boost'` | `'premium_plan'`) + `purchasable_id` — linking to either `listing_boosts` or `user_subscriptions` without a table per purchase type or a nullable-foreign-key-per-type anti-pattern. `properties.owner_id` → `users.id`; `property_locations`/`property_images`/`property_features` all cascade from `properties.id`. `conversations` ↔ `users` is many-to-many through `conversation_participants`.

## Indexing

Every foreign key used in a real query path has a covering index — verified during Part 3's performance audit, which also found and fixed one real gap (`user_subscriptions.plan_id`, migration `1700000000043`). Two FK columns that looked unindexed by a naive grep (`property_reports.reporter_user_id`, `user_reports.reporter_user_id`) turned out to already be covered by each table's own `UNIQUE(x, reporter_user_id)` constraint, which Postgres backs with an automatic index — confirmed by reading the actual migrations, not assumed. `listing_boosts` and `user_subscriptions` additionally carry a **partial index** (`WHERE status = 'active'`) for their respective "does this listing/user currently have an active boost/plan" hot-path queries.

## Migrations reference

| # | Migration |
|---|---|
| 1 | enable-extensions |
| 2 | create-set-updated-at-function |
| 3 | create-users-table |
| 4 | create-roles-table |
| 5 | create-user-roles-table |
| 6 | create-user-devices-table |
| 7 | create-sessions-table |
| 8 | create-refresh-tokens-table |
| 9 | create-otp-codes-table |
| 10 | create-notifications-table |
| 11 | create-user-preferences-table |
| 12 | create-audit-logs-table |
| 13 | create-activity-logs-table |
| 14 | seed-roles |
| 15 | create-property-categories-table |
| 16 | create-properties-table |
| 17 | create-property-locations-table |
| 18 | create-property-images-table |
| 19 | create-property-features-table |
| 20 | create-property-views-table |
| 21 | create-property-favorites-table |
| 22 | create-property-reports-table |
| 23 | create-property-status-history-table |
| 24 | create-saved-searches-table |
| 25 | seed-property-categories |
| 26 | add-moderation-columns-to-properties |
| 27 | add-identity-verified-at-to-users |
| 28 | create-user-reports-table |
| 29 | create-identity-verifications-table |
| 30 | create-conversations-table |
| 31 | create-conversation-participants-table |
| 32 | create-messages-table |
| 33 | add-push-token-to-user-devices |
| 34 | create-premium-plans-table |
| 35 | create-payment-orders-table |
| 36 | create-payments-table |
| 37 | create-refunds-table |
| 38 | create-invoices-table |
| 39 | create-listing-boosts-table |
| 40 | create-user-subscriptions-table |
| 41 | create-webhook-events-table |
| 42 | seed-premium-plans |
| 43 | add-plan-id-index-to-user-subscriptions |

## Backup & recovery

Covered in full in `backend/docs/phase-6-part5-backup-recovery.md` — `pg_dump`-based backup/restore scripts, retention policy, and a disaster-recovery runbook per failure scenario.
