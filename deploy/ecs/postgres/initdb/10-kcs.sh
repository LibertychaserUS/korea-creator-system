#!/bin/sh
# Runs once, on an empty data directory (docker-entrypoint-initdb.d).
# The kcs database is POSTGRES_DB; the TinyShip identity database sits next to it.
# pg_stat_statements is preloaded by the compose command line.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE DATABASE tinyship OWNER kcs;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname tinyship <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL
