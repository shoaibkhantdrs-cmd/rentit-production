# Database

- `init/` — SQL run once by Postgres itself on first container start
  (extensions only). Not for application schema.
- `migrations/` — versioned schema migrations, run via `node-pg-migrate`
  (see root README / PHASE2 docs for commands).

## Conventions

- Every table uses a `UUID` primary key (`gen_random_uuid()`, core since
  Postgres 13 — no extension required for this specific function).
- Every mutable table has `created_at` / `updated_at`, the latter kept in
  sync by the shared `set_updated_at()` trigger function
  (migration `1700000000002`).
- Soft delete (`deleted_at`) is applied to independently-deletable entities:
  `users`, `roles`, `user_devices`, `notifications`.
- Soft delete is **not** applied to:
  - `refresh_tokens` / `sessions` / `otp_codes` — these have their own
    lifecycle columns (`revoked_at`, `consumed_at`, `expires_at`) that
    already express "no longer valid" more precisely than a generic
    `deleted_at` would.
  - `user_preferences` — a 1:1 config row that lives and dies with its
    user via `ON DELETE CASCADE`; it has no independent lifecycle.
  - `audit_logs` / `activity_logs` — deliberately immutable, append-only.
    An audit trail that can be edited or soft-deleted stops being an audit
    trail, so these tables have no `updated_at` or `deleted_at` at all.
  - `user_roles` — a plain junction table; revoking a role is a row
    deletion, not a soft delete, and is itself recorded in `audit_logs`.
- Uniqueness that must coexist with soft delete (`users.email`,
  `users.phone`, `roles.name`, `user_devices.(user_id, device_id)`) is
  enforced with partial unique indexes (`WHERE deleted_at IS NULL`) so a
  deleted row doesn't block reuse of the same value.

The same conventions carry through the Phase 3 property tables:
`property_locations` follows the `user_preferences` pattern (1:1, cascades,
no independent lifecycle); `property_features` and `property_favorites`
follow the `user_roles` pattern (a tag either applies or it doesn't --
toggling is insert/delete, not soft delete); `property_views` and
`property_status_history` follow the `audit_logs` pattern (immutable,
append-only); `property_reports` has its own `status` column instead of
soft delete because it's a moderation record whose lifecycle the Phase 4
admin panel will manage explicitly, not something that gets "deleted".
`property_images` gets a partial unique index limiting each property to
at most one `is_primary = true` row, plus a `BEFORE INSERT` trigger that
backstops the application-layer "max 10 images" rule at the database level.

Phase 4 (Admin / Moderation) adds: `is_featured` / `moderated_by` /
`moderated_at` / `rejection_reason` columns on `properties` plus a
`'rejected'` status value (all additive -- the Phase 3 column set and API
responses are unchanged unless the new fields are explicitly requested);
`identity_verified_at` on `users`, mirroring `email_verified_at` /
`phone_verified_at`; `user_reports`, a structural mirror of
`property_reports` for reporting a user instead of a listing; and
`identity_verifications`, which follows the `property_reports` "own status
column, no soft delete" pattern since it's a moderation record, not
user-owned content -- a rejected submission stays in the table as a record
of that decision, and the user can submit a new row rather than editing
the old one. No new table was needed for admin broadcast notifications --
they reuse the existing Phase 2 `notifications` table (one row per
recipient), and "Moderation History" (Part 3) reuses Phase 3's existing
`property_status_history` table directly, since every status change
(including admin approve/reject/hide) already writes a row there.

See `docs/phase-2.md`, `docs/phase-3.md`, and `docs/phase-4.md` at the
project root for the full ER diagrams and table-by-table documentation.
