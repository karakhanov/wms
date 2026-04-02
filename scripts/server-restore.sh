#!/usr/bin/env bash
# Restore DB + media on Linux server. Run from WMS repo root or pass paths.
# Prerequisites: pg_restore (version >= dump format), unzip.
#
# Usage:
#   export POSTGRES_HOST=localhost POSTGRES_USER=wms POSTGRES_DB=wms POSTGRES_PASSWORD=...
#   bash scripts/server-restore.sh deploy-export/database.dump deploy-export/media.zip
#
# Optional: PGRESTORE_BIN=/usr/lib/postgresql/18/bin/pg_restore  (override auto-detect)
#
# If second arg omitted, looks for wms_media_export.zip or media.zip next to the dump.
set -euo pipefail

DUMP="${1:-./wms_backup.dump}"
MEDIA_ZIP="${2:-}"
if [[ -z "$MEDIA_ZIP" ]]; then
  DDIR=$(dirname "$DUMP")
  for name in wms_media_export.zip media.zip; do
    if [[ -f "$DDIR/$name" ]]; then
      MEDIA_ZIP="$DDIR/$name"
      break
    fi
  done
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

# Pick pg_restore: explicit PGRESTORE_BIN, else default in PATH if it reads the dump,
# else try /usr/lib/postgresql/{18..14}/bin/pg_restore (Debian/Ubuntu PGDG layout).
resolve_pg_restore() {
  local dump="$1"
  if [[ -n "${PGRESTORE_BIN:-}" ]]; then
    if [[ ! -x "$PGRESTORE_BIN" ]]; then
      echo "PGRESTORE_BIN is not executable: $PGRESTORE_BIN" >&2
      exit 1
    fi
    echo "$PGRESTORE_BIN"
    return
  fi
  if command -v pg_restore >/dev/null 2>&1; then
    local def
    def=$(command -v pg_restore)
    if "$def" -l "$dump" >/dev/null 2>&1; then
      echo "$def"
      return
    fi
  fi
  local v p
  for v in 18 17 16 15 14; do
    p="/usr/lib/postgresql/${v}/bin/pg_restore"
    if [[ -x "$p" ]] && "$p" -l "$dump" >/dev/null 2>&1; then
      echo "$p"
      return
    fi
  done
  echo "No pg_restore can read this dump (try a newer postgresql-client or set PGRESTORE_BIN)." >&2
  exit 1
}

PGRESTORE=$(resolve_pg_restore "$DUMP")
echo "Using $(basename "$PGRESTORE") ($("$PGRESTORE" --version | head -1))"

echo "Restoring database $PGDATABASE on $PGHOST (user $PGUSER)..."
export PGPASSWORD
set +e
"$PGRESTORE" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-owner --verbose "$DUMP"
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
