#!/usr/bin/env bash
# Phase 6 Part 5 (backup & recovery): full-database backup using pg_dump's
# custom format (-Fc). Custom format is compressed, supports parallel
# restore (pg_restore -j), and allows restoring a single table/schema
# selectively -- plain SQL dumps support none of that.
#
# Usage:
#   ./scripts/backup-db.sh                      # uses $DATABASE_URL
#   DATABASE_URL=postgres://... ./scripts/backup-db.sh
#   BACKUP_DIR=/mnt/backups ./scripts/backup-db.sh
#
# Exit codes: 0 success, 1 missing DATABASE_URL, 2 pg_dump failed.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export it or pass it inline." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/rentit_${TIMESTAMP}.dump"

echo "Backing up database to: $OUT_FILE"
if ! pg_dump --format=custom --no-owner --no-privileges --file="$OUT_FILE" "$DATABASE_URL"; then
  echo "ERROR: pg_dump failed -- see output above." >&2
  # Remove a partial/corrupt file rather than leaving it around to be
  # mistaken for a valid backup later.
  rm -f "$OUT_FILE"
  exit 2
fi

# Integrity check: pg_restore --list reads the dump's TOC without writing
# anything to a database. A backup that fails this is not worth keeping --
# fail loudly now rather than discovering a corrupt backup during an
# actual disaster.
if ! pg_restore --list "$OUT_FILE" > /dev/null 2>&1; then
  echo "ERROR: backup written but failed the pg_restore --list integrity check. Not trustworthy -- removing it." >&2
  rm -f "$OUT_FILE"
  exit 2
fi

SIZE_HUMAN="$(du -h "$OUT_FILE" | cut -f1)"
echo "Backup OK: $OUT_FILE ($SIZE_HUMAN)"

# Retention: delete backups in this directory older than $RETENTION_DAYS.
# Local retention only -- see docs/phase-6-part5-backup-recovery.md for why
# off-host replication (S3/similar) is a separate, required step, not
# something this script does implicitly.
find "$BACKUP_DIR" -maxdepth 1 -name 'rentit_*.dump' -mtime "+${RETENTION_DAYS}" -print -delete

echo "Done."
