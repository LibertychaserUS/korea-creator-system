#!/bin/sh
# kcs/tools: `init` (schema + first admin) and the backup / restore commands.
#   docker compose run --rm init <command> [args]
set -eu
cd /repo
cmd="${1:-init}"
[ "$#" -gt 0 ] && shift
case "$cmd" in
  init) exec node --import tsx deploy/tools/init.ts "$@" ;;
  *)
    if [ -f "deploy/tools/$cmd.sh" ]; then exec sh "deploy/tools/$cmd.sh" "$@"; fi
    if [ -f "deploy/tools/$cmd.ts" ]; then exec node --import tsx "deploy/tools/$cmd.ts" "$@"; fi
    exec "$cmd" "$@"
    ;;
esac
