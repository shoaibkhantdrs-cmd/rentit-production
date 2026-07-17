# RentIt Administrator Manual (v1.0)

For anyone with the `admin` or `super_admin` role, operating the platform day-to-day via the `/admin` panel and the operational tooling around it.

## Accessing the admin panel

Log in with an account that has the `admin` or `super_admin` role, then visit `/admin`. Regular users are redirected away (`RequireAdmin` component); the entire admin section is a separate, lazily-loaded bundle so it never downloads for non-admin users.

## Dashboard

`/admin` (Dashboard) shows headline stats (user/property/report counts, revenue if payments are configured) and system health (`/admin/system/health` — a richer check than the public `/health`, including recent error rates if Sentry is configured).

## Moderating properties

`/admin/properties` — every listing awaiting review or already published. Approve, reject (with a reason, shown to the owner), hide (temporarily remove from search without deleting), unhide, feature (boost in search ranking), or bulk-moderate several at once. `/admin/properties/moderation-history` shows every past decision, and `/admin/properties/:id/history` shows one listing's full status timeline — useful when a listing has been rejected and resubmitted multiple times.

## Managing users

`/admin/users` — search by name/email/phone, filter by status/role. Open a profile to see activity history, change status (active/suspended/banned — a reason is required and shown to the user), force a password reset, or change roles. Role changes take effect on the user's next token refresh (access tokens embed roles and are short-lived by design — see `docs/phase-2.md`).

## Reports queue

`/admin/reports` — both property reports and user reports land here, each with a status you can move through your own review workflow (pending → reviewed → actioned/dismissed).

## Identity verification

`/admin/verification` — submitted documents awaiting approval/rejection. Approving sets `identity_verified_at` on the user's record, which several parts of the product (e.g. a "verified" badge) already key off of.

## Payments

`/admin/payments` (reachable via the API even where not yet linked in the nav — see `API_DOCUMENTATION.md`'s Admin section) lists every payment across both gateways, lets you view refunds for a specific payment, and issue a refund (full or partial — the system tracks already-refunded amounts and will not let you over-refund, a bug found and fixed during Part 2's security audit).

## Notifications & analytics

`/admin/notifications` sends a broadcast notification to a chosen audience. `/admin/analytics` shows growth metrics (signups, listings) over a configurable window and top-performing properties by view/favorite count.

## Audit log

`/admin/audit-logs` — every admin action (who, what, when, on what target) is recorded here automatically by the use-cases themselves, not as an afterthought — see `ARCHITECTURE.md`'s note on `audit_logs`.

## Operating the production system (beyond the panel)

- **Health**: `GET /health` (readiness, checks DB) and `GET /health/live` (liveness, no I/O) — see `backend/docs/phase-6-part4-observability.md`.
- **Metrics & dashboards**: `GET /metrics` (Prometheus format, token-gated) feeds the Grafana dashboards set up in `monitoring/` — bring them up with `docker compose --profile observability up` (dev) or they run by default in `docker-compose.prod.yml`.
- **Backups**: `npm run backup:db` (or however it's scheduled in production — see `backend/docs/phase-6-part5-backup-recovery.md`). Restoring is a deliberate, confirmation-gated action (`npm run restore:db -- <file>`) — never run against production without reading that doc's disaster-recovery table first.
- **Deploys**: handled by CI/CD (`.github/workflows/`) — see `backend/docs/phase-6-part6-cicd.md`. A manual production deploy is triggered via the `deploy.yml` workflow's "Run workflow" button in GitHub Actions, not by pushing directly to a server.
