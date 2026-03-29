#!/usr/bin/env bash
# Restore DB + media on Linux server. Run from WMS repo root or pass paths.
# Prerequisites: pg_restore, unzip, same or newer PostgreSQL major as dump source.
#
# Usage:
#   export POSTGRES_HOST=localhost POSTGRES_USER=wms POSTGRES_DB=wms POSTGRES_PASSWORD=...
#   bash scripts/server-restore.sh /path/to/wms_backup.dump /path/to/wms_media_export.zip
#
# If second arg omitted, looks for ./wms_media_export.zip next to dump.
set -euo pipefail

DUMP="${1:-./wms_backup.dump}"
MEDIA_ZIP="${2:-}"
if [[ -z "$MEDIA_ZIP" ]]; then
  DDIR=$(dirname "$DUMP")
  if [[ -f "$DDIR/wms_media_export.zip" ]]; then
    MEDIA_ZIP="$DDIR/wms_media_export.zip"
  fi
fi

PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-wms}"
PGPASSWORD="${POSTGRES_PASSWORD:-wms}"
PGDATABASE="${POSTGRES_DB:-wms}"
export PGHOST PGPORT PGUSER PGPASSWORD

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
MEDIA_TARGET="${REPO_ROOT}/backend/media"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump not found: $DUMP" >&2
  exit 1
fi

echo "Restoring database $PGDATABASE on $PGHOST (user $PGUSER)..."
export PGPASSWORD
set +e
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-owner --verbose "$DUMP"
rc=$?
set -e
# pg_restore often exits 1 when only warnings were printed
if [[ "$rc" -ne 0 && "$rc" -ne 1 ]]; then
  echo "Restore failed (exit $rc). If DB is not empty, recreate it, e.g.:"
  echo "  sudo -u postgres dropdb $PGDATABASE && sudo -u postgres createdb -O $PGUSER $PGDATABASE"
  exit "$rc"
fi

if [[ -n "$MEDIA_ZIP" && -f "$MEDIA_ZIP" ]]; then
  mkdir -p "$MEDIA_TARGET"
  unzip -o "$MEDIA_ZIP" -d "$MEDIA_TARGET"
  echo "Media unpacked to $MEDIA_TARGET"
else
  echo "No media zip; skipped."
fi

echo "Run migrations if needed: cd backend && source .venv/bin/activate && python manage.py migrate"
echo "Restart gunicorn (or your app service)."
