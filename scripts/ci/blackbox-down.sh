#!/usr/bin/env bash
# Stop whatever scripts/ci/blackbox-up.sh started (same BLACKBOX_RUN_DIR).
set -uo pipefail

RUN_DIR="${BLACKBOX_RUN_DIR:-${RUNNER_TEMP:-/tmp}/kcs-blackbox}"
shopt -s nullglob
for pidfile in "$RUN_DIR"/*.pid; do
  name="$(basename "$pidfile" .pid)"
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    echo "[blackbox-down] stopped $name (pid $pid)"
  fi
  rm -f "$pidfile"
done
