# Phase 6 Part 5 — Backup & Recovery

## What's covered vs. what isn't

The PostgreSQL database is the only system-of-record this backup strategy covers directly — it holds every user, property, message, payment, and audit record. Two other stores hold data but are deliberately **not** backed up here because they're already durable, versioned, external services with their own retention:

- **Cloudinary** (property images): Cloudinary retains uploaded originals indefinitely per its own SLA. Re-uploading from a database backup that references `cloudinary_public_id` values only re-links to images that are already safe.
- **Firebase Cloud Messaging** (push tokens/delivery): stateless from this app's perspective — device tokens live in our DB (covered by the DB backup) and are re-registered by the client on next app open regardless.

If Cloudinary access itself were ever lost (account deleted, not a RentIt-side failure), that's a vendor-relationship incident, not something a database backup can address — worth knowing going in rather than assuming DB backups are a complete disaster-recovery story.

## Database backup

`scripts/backup-db.sh` — `pg_dump --format=custom` (compressed, supports parallel restore and selective restore, unlike a plain `.sql` dump). Every run:

1. Writes a timestamped `.dump` file to `$BACKUP_DIR` (default: `backend/backups/`, override for a mounted volume in production).
2. Verifies the dump with `pg_restore --list` immediately after writing it — a backup that fails this check is deleted on the spot rather than kept and discovered broken during an actual incident.
3. Deletes local backups older than `$BACKUP_RETENTION_DAYS` (default 14).

Run manually with `npm run backup:db`, or on a schedule — see "Automation" below. Verified end-to-end (with `pg_dump`/`pg_restore` calls stubbed, since this sandbox has neither installed) against 9 real scenarios: missing config, success, corruption detection + cleanup, and retention deletion. See `docs/logs/phase6-part5-backup-scripts-verification.log`.

**Off-host replication is required, not optional.** A backup that lives only on the same disk/volume as the database it backs up does not survive the failure modes that actually destroy databases (disk failure, host loss, an operator running `rm -rf` on the wrong path). Ship every backup file to object storage (S3, GCS, R2, or equivalent) immediately after it's written and verified — a one-line `aws s3 cp` / `gsutil cp` / `rclone copy` appended to whatever schedules `backup-db.sh` (see Automation) is enough; no code in this repo needs to change to add that.

## Restore guide

`scripts/restore-db.sh <path-to-backup.dump>`:

1. Refuses to run without a target `DATABASE_URL` or a readable backup file.
2. Re-verifies the backup's integrity (`pg_restore --list`) *before* touching the target database — a corrupt backup is refused before any destructive step, not discovered mid-restore.
3. Prints exactly what's about to happen and requires typing `restore` to confirm (skippable with `SKIP_CONFIRM=1` for scripted/CI use) — this runs `--clean --if-exists`, which drops existing objects in the target before recreating them, so an accidental run against the wrong `DATABASE_URL` is a real risk worth a deliberate confirmation step.
4. Restores with `pg_restore --clean --if-exists --no-owner --no-privileges --jobs=N`.

After any restore: run `npm run migrate:up` (the backup may predate migrations applied since it was taken) and spot-check row counts:

```sql
select count(*) from users;
select count(*) from properties;
select count(*) from payments;
select max(created_at) from payments;  -- confirms how much data is actually present
```

### Testing this in a real environment

This sandbox has no `pg_dump`/`pg_restore` binaries and no network path to install them, so the scripts above were verified with those two commands stubbed out (see the log referenced above) rather than against a live Postgres instance. **Before relying on this in production**, run a real drill at least once: back up a non-production database, restore it into a scratch database, and confirm the row-count spot checks match. A backup strategy that has never been test-restored is not a verified backup strategy — it's a hope.

## Disaster recovery

Recovery Point Objective (RPO) and Recovery Time Objective (RTO) depend entirely on backup frequency and where backups are replicated to — see "Automation" for the concrete numbers a given schedule implies.

| Scenario | Response |
|---|---|
| Accidental bad data (e.g. an admin action deletes/corrupts real rows) | Restore the most recent backup into a **scratch** database first, extract only the affected rows, and manually reconcile them into production. Do not `restore-db.sh` directly into production for a partial-data incident — that throws away every correct write made since the backup, which is almost always worse than the original problem. |
| Database corruption / instance failure | Provision a new Postgres instance, run `migrate:up` to get schema to the latest version if the backup predates it, then `restore-db.sh` the latest verified backup into it, then repoint `DATABASE_URL` at the new instance and redeploy the backend. |
| Full region/host loss (backups included) | Only survivable if backups were replicated off-host (see above) — restore from the offsite copy into a fresh instance in a different region/host, following the same steps as database corruption above. This is precisely why off-host replication is called out as required, not optional, above. |
| Leaked/compromised database credentials | Rotate the Postgres password and `JWT_ACCESS_SECRET` immediately (a leaked DB credential plus a leaked JWT secret together let an attacker mint valid sessions), update `DATABASE_URL` everywhere it's configured, and review `audit_log`/`activity_log` for the credential's active window to scope what, if anything, was accessed. |

### Automation

`backup-db.sh` is a plain script, not a scheduled job by itself — wire it into whatever your deployment target provides: a cron entry (`0 2 * * * cd /path/to/backend && npm run backup:db >> /var/log/rentit-backup.log 2>&1`), a Kubernetes CronJob, or (once Part 6/CI-CD exists) a scheduled GitHub Actions workflow. Daily backups give an RPO of "up to 24 hours of data loss in the worst case" and an RTO of "however long a restore + redeploy takes" (minutes for a database of this app's likely early-stage size). Tighten the schedule (hourly, or continuous WAL archiving via `pg_basebackup`/`wal-g` for near-zero RPO) once real transaction volume justifies the added operational complexity — not needed on day one.
