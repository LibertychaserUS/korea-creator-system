#!/bin/sh
# The `backup` service: sleeps until BACKUP_HOUR (container TZ), runs backup.sh, repeats.
# A failed run is logged and retried after BACKUP_RETRY_MINUTES; the loop never exits on it.
set -eu
HOUR="${BACKUP_HOUR:-3}"
RETRY_MINUTES="${BACKUP_RETRY_MINUTES:-60}"

log() { printf '{"ts":"%s","job":"backup-daemon","msg":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:+,$2}"; }

stop=0
trap 'stop=1; [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true' TERM INT
nap() {
  sleep "$1" &
  pid=$!
  wait "$pid" || true
  pid=
}

run_once() {
  if sh /repo/deploy/tools/backup.sh; then return 0; fi
  log "backup failed, retrying later" "\"retryMinutes\":$RETRY_MINUTES"
  return 1
}

[ "${BACKUP_ON_START:-0}" = "1" ] && { run_once || true; }

while [ "$stop" -eq 0 ]; do
  now="$(date +%s)"
  next="$(date -d "today $HOUR:00" +%s)"
  [ "$next" -le "$now" ] && next="$(date -d "tomorrow $HOUR:00" +%s)"
  log "sleeping until next run" "\"at\":\"$(date -d "@$next" +%FT%T%z)\""
  nap $(( next - now ))
  [ "$stop" -eq 1 ] && break
  until run_once; do
    nap $(( RETRY_MINUTES * 60 ))
    [ "$stop" -eq 1 ] && break
  done
done
log "stopped"
