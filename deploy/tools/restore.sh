#!/bin/sh
# Real restore into the LIVE databases — replaces their contents.
#   docker compose -f compose.prod.yml stop api api-worker marketing select ops dev backup
#   docker compose -f compose.prod.yml run --rm --no-deps -e RESTORE_CONFIRM=<stamp> backup restore <stamp> [--from-s3]
#   docker compose -f compose.prod.yml up -d
# Run restore-drill on the same stamp first.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kcs}"
: "${KCS_DATABASE_URL:?KCS_DATABASE_URL is required}"
: "${IDENTITY_DATABASE_URL:?IDENTITY_DATABASE_URL is required}"
log() { printf '{"ts":"%s","job":"restore","msg":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:+,$2}"; }

stamp="${1:-}"
[ -n "$stamp" ] || { log "usage: restore <stamp> [--from-s3]"; exit 2; }
[ "${RESTORE_CONFIRM:-}" = "$stamp" ] || { log "set RESTORE_CONFIRM=$stamp to confirm overwriting the live databases"; exit 2; }

run="$BACKUP_DIR/$stamp"
if [ "${2:-}" = "--from-s3" ] || [ ! -d "$run" ]; then
  run="$(mktemp -d)/$stamp"
  node --import tsx /repo/deploy/tools/backup-s3.ts download "$stamp" "$run"
fi
(cd "$run" && sha256sum -c SHA256SUMS >/dev/null) || { log "checksum mismatch"; exit 1; }

for pair in "kcs:$KCS_DATABASE_URL" "identity:$IDENTITY_DATABASE_URL"; do
  name="${pair%%:*}"
  url="${pair#*:}"
  pg_restore --dbname="$url" --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error "$run/$name.dump"
  log "restored" "\"database\":\"$name\",\"stamp\":\"$stamp\""
done
log "done — start the stack again; init re-runs and applies any newer migrations"
