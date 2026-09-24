#!/bin/sh
# Restore drill: prove a backup restores, without touching the live databases.
#   docker compose -f compose.prod.yml exec backup /repo/deploy/tools/entrypoint.sh restore-drill [<stamp>|latest] [--from-s3]
# Restores both dumps into scratch databases <db>_drill on the same server
# (the role needs CREATEDB; on RDS use a privileged account or a spare
# instance), compares key row counts with live, reports the time taken, and
# drops the scratch databases again (DRILL_KEEP=1 keeps them for a look).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kcs}"
: "${KCS_DATABASE_URL:?KCS_DATABASE_URL is required}"
: "${IDENTITY_DATABASE_URL:?IDENTITY_DATABASE_URL is required}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

log() { printf '{"ts":"%s","job":"restore-drill","msg":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:+,$2}"; }
with_db() { node -e 'const u = new URL(process.argv[1]); u.pathname = "/" + process.argv[2]; console.log(u.toString())' "$1" "$2"; }
db_of() { node -e 'console.log(decodeURIComponent(new URL(process.argv[1]).pathname.slice(1)))' "$1"; }

stamp="latest"
from_s3=0
for arg in "$@"; do
  case "$arg" in
    --from-s3) from_s3=1 ;;
    *) stamp="$arg" ;;
  esac
done

if [ "$stamp" = "latest" ]; then
  if [ "$from_s3" -eq 1 ]; then
    stamp="$(node --import tsx /repo/deploy/tools/backup-s3.ts list | head -n1)"
  else
    stamp="$(cat "$BACKUP_DIR/LATEST" 2>/dev/null || true)"
  fi
fi
[ -n "$stamp" ] || { log "no backup to drill (run backup first)"; exit 1; }

run="$BACKUP_DIR/$stamp"
if [ "$from_s3" -eq 1 ] || [ ! -d "$run" ]; then
  run="$(mktemp -d)/$stamp"
  node --import tsx /repo/deploy/tools/backup-s3.ts download "$stamp" "$run"
fi
(cd "$run" && sha256sum -c SHA256SUMS >/dev/null) || { log "checksum mismatch" "\"stamp\":\"$stamp\""; exit 1; }
log "checksums ok" "\"stamp\":\"$stamp\",\"dir\":\"$run\""

started="$(date +%s)"
report=""
for pair in "kcs:$KCS_DATABASE_URL:creators ingest_jobs creator_raw projects assets schema_migrations" \
            "identity:$IDENTITY_DATABASE_URL:user account session"; do
  name="${pair%%:*}"
  rest="${pair#*:}"
  tables="${rest##*:}"
  live="${rest%:*}"
  scratch_name="$(db_of "$live")_drill"
  scratch="$(with_db "$live" "$scratch_name")"
  admin="$(with_db "$live" postgres)"
  psql "$admin" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$scratch_name\" WITH (FORCE)"
  psql "$admin" -v ON_ERROR_STOP=1 -qc "CREATE DATABASE \"$scratch_name\""
  t0="$(date +%s)"
  pg_restore --dbname="$scratch" --no-owner --no-acl --exit-on-error "$run/$name.dump"
  seconds=$(( $(date +%s) - t0 ))
  for table in $tables; do
    restored="$(psql "$scratch" -Atc "SELECT count(*) FROM \"$table\"")"
    current="$(psql "$live" -Atc "SELECT count(*) FROM \"$table\"" 2>/dev/null || echo null)"
    report="$report{\"database\":\"$name\",\"table\":\"$table\",\"restored\":$restored,\"live\":$current},"
  done
  log "restored" "\"database\":\"$name\",\"into\":\"$scratch_name\",\"seconds\":$seconds"
  if [ "${DRILL_KEEP:-0}" != "1" ]; then
    psql "$admin" -v ON_ERROR_STOP=1 -qc "DROP DATABASE \"$scratch_name\" WITH (FORCE)"
  fi
done
log "drill passed" "\"stamp\":\"$stamp\",\"seconds\":$(( $(date +%s) - started )),\"counts\":[${report%,}]"
