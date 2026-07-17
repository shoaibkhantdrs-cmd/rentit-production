# Phase 6 Part 8 — Deployment Guide: PostgreSQL

## Hosting options

**Managed Postgres** (RDS, Cloud SQL, Neon, Supabase, Render/Railway's managed Postgres add-on) — recommended default. Handles patching, automated backups, and failover, which is exactly the operational burden this app's own backup/recovery tooling (Part 5) is designed to be a *fallback* for, not a replacement for a provider's own point-in-time recovery.

**Self-managed** (the `postgres:16-alpine` image in `docker-compose.prod.yml`, or a bare-metal install) — viable, but now `scripts/backup-db.sh`/`restore-db.sh` (Part 5) are load-bearing, not a supplement to a managed provider's own backups. Off-host replication of every backup (see Part 5's doc) is not optional in this configuration.

## Connection configuration

`DATABASE_URL` follows the standard `postgresql://user:password@host:port/database` form `src/config/database.ts` already expects — no code change needed to point at a managed provider instead of a local/Docker instance, only the connection string. Most managed providers require `?sslmode=require` (or equivalent) in the connection string for external connections; `pg`'s `Pool` respects this via the connection string directly, but confirm the provider's exact required value (some need `sslmode=verify-full` with a specific CA bundle) before assuming `require` is sufficient for their setup.

## Connection pooling

`config/database.ts`'s `Pool` is a single in-process connection pool per backend instance — fine at one or a few backend instances. Once running enough backend instances that their combined pool sizes approach the database's own `max_connections` (Postgres defaults to 100), add PgBouncer (or a managed provider's built-in equivalent, e.g. RDS Proxy) in front of Postgres rather than raising `max_connections` indefinitely — connection pooling at the proxy layer scales further than raw Postgres connections do. Not needed at launch; worth planning for once instance count grows.

## Migrations

Same note as the backend deployment guide: `npm run migrate:up` runs once per deploy with new migrations, against the real production `DATABASE_URL`, from a single controlled place (CI, or a deploy script) — never automatically on every container start.

## Backup & recovery

Covered in full in `docs/phase-6-part5-backup-recovery.md` — `scripts/backup-db.sh`/`restore-db.sh`, retention, disaster-recovery runbook, and the off-host-replication requirement. If using a managed provider with its own automated backups, still worth running `backup-db.sh` on a schedule independently — a provider account lockout or billing issue is a failure mode a second, independently-stored backup protects against that the provider's own backups (stored in the same account) do not.

## Monitoring

Whichever hosting choice, watch connection count (approaching `max_connections`), disk usage (especially with the JSON-heavy audit/activity logs from Phase 4 accumulating over time), and replication lag if a read replica is ever added. Prometheus's `postgres_exporter` can feed these into the Grafana setup already wired up in Part 4 if self-hosting; managed providers typically expose the same metrics through their own dashboards.
