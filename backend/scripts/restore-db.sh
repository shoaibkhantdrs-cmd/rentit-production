#!/usr/bin/env bash
# Phase 6 Part 5 (backup & recovery): restores a pg_dump custom-format
# backup (see backup-db.sh) into a target database.
#
# Usage:
#   ./scripts/restore-db.sh /path/to/rentit_20260713T120000Z.dump
#   DATABASE_URL=postgres://... ./scripts/restore-db.sh backup.dump
#
# By default this restores into the database named in $DATABASE_URL,
# which must already exist and be reachable -- it does NOT create a new
# database or drop the target first (see the --clean note below).
#
# Exit codes: 0 success, 1 bad arguments/missing DATABASE_URL, 2 restore failed.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-backup.dump>" >&2
  exit 1
fi

DUMP_FILE="$1"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: backup file not found: $DUMP_FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export it or pass it inline." >&2
  exit 1
fi

echo "About to restore:"
echo "  Backup file: $DUMP_FILE"
echo "  Target:      $DATABASE_URL"
echo
echo "This will apply --clean --if-exists, which DROPS existing objects in"
echo "the target database before recreating them from the backup. Any data"
echo "in the target database NOT present in the backup will be lost."
echo

if [[ "${SKIP_CONFIRM:-}" != "1" ]]; then
  read -r -p "Type 'restore' to continue: " CONFIRM
  if [[ "$CONFIRM" != "restore" ]]; then
    echo "Aborted -- confirmation text did not match." >&2
    exit 1
  fi
fi

echo "Verifying backup integrity before touching the target database..."
if ! pg_restore --list "$DUMP_FILE" > /dev/null 2>&1; then
  echo "ERROR: backup file failed the pg_restore --list integrity check -- refusing to restore a corrupt/truncated dump." >&2
  exit 2
fi

echo "Restoring (parallel jobs: ${RESTORE_JOBS:-4})..."
if ! pg_restore \
  --clean --if-exists --no-owner --no-privileges \
  --jobs="${RESTORE_JOBS:-4}" \
  --dbname="$DATABASE_URL" \
  "$DUMP_FILE"; then
  echo "ERROR: pg_restore reported errors -- see output above. Some pg_restore" >&2
  echo "warnings (e.g. 'role does not exist' from --no-owner) are expected and" >&2
  echo "harmless; a nonzero exit with 'FATAL'/relation-missing errors is not." >&2
  exit 2
fi

echo "Restore complete. Recommended next steps:"
echo "  1. Run 'npm run migrate:up' to apply any migrations newer than this backup."
echo "  2. Spot-check row counts against docs/phase-6-part5-backup-recovery.md's verification queries."
