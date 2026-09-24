#!/bin/sh
# One backup run (the `backup` service calls it daily; by hand:
#   docker compose -f compose.prod.yml exec backup /repo/deploy/tools/entrypoint.sh backup):
#   1. pg_dump both databases, custom format (compressed, restorable table by table)
#   2. check each dump reads back (pg_restore --list)
#   3. upload the run to OSS under BACKUP_S3_PREFIX<stamp>/ when BACKUP_S3_BUCKET is set
#   4. drop local and remote runs older than BACKUP_RETENTION_DAYS
# Layout: $BACKUP_DIR/<UTC stamp>/{kcs.dump,identity.dump,manifest.json}; LATEST names the newest.
set -eu
umask 022

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kcs}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
: "${KCS_DATABASE_URL:?KCS_DATABASE_URL is required}"
: "${IDENTITY_DATABASE_URL:?IDENTITY_DATABASE_URL is required}"

log() { printf '{"ts":"%s","job":"backup","msg":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:+,$2}"; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
run="$BACKUP_DIR/$stamp"
tmp="$BACKUP_DIR/.partial-$stamp"
mkdir -p "$tmp"
trap 'rm -rf "$tmp"' EXIT

started="$(date +%s)"
for pair in "kcs:$KCS_DATABASE_URL" "identity:$IDENTITY_DATABASE_URL"; do
  name="${pair%%:*}"
  url="${pair#*:}"
  pg_dump --dbname="$url" --format=custom --compress=6 --no-owner --no-acl --file="$tmp/$name.dump"
  pg_restore --list "$tmp/$name.dump" >/dev/null
  size="$(stat -c %s "$tmp/$name.dump")"
  sum="$(sha256sum "$tmp/$name.dump" | cut -d' ' -f1)"
  log "dumped" "\"database\":\"$name\",\"bytes\":$size"
  printf '%s  %s.dump\n' "$sum" "$name" >>"$tmp/SHA256SUMS"
done
server="$(psql "$KCS_DATABASE_URL" -Atc 'SHOW server_version' 2>/dev/null || echo unknown)"
cat >"$tmp/manifest.json" <<JSON
{"stamp":"$stamp","createdAt":"$(date -u +%FT%TZ)","server":"$server","pgDump":"$(pg_dump --version | awk '{print $3}')","files":["kcs.dump","identity.dump"]}
JSON
mv "$tmp" "$run"
trap - EXIT
printf '%s\n' "$stamp" >"$BACKUP_DIR/LATEST"
log "local run complete" "\"stamp\":\"$stamp\",\"seconds\":$(( $(date +%s) - started ))"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  node --import tsx /repo/deploy/tools/backup-s3.ts upload "$run" "$stamp"
  node --import tsx /repo/deploy/tools/backup-s3.ts prune "$RETENTION"
else
  log "BACKUP_S3_BUCKET not set: this run stays on the ECS disk only"
fi

# Local retention: run directories are named by UTC stamp, so compare names.
cutoff="$(date -u -d "-$RETENTION days" +%Y%m%dT%H%M%SZ)"
for dir in "$BACKUP_DIR"/2*; do
  [ -d "$dir" ] || continue
  base="$(basename "$dir")"
  if expr "$base" \< "$cutoff" >/dev/null; then
    rm -rf "$dir"
    log "pruned local run" "\"stamp\":\"$base\""
  fi
done
log "done" "\"stamp\":\"$stamp\""
