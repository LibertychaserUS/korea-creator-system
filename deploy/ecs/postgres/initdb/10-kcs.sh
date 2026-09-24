#!/bin/sh
# Runs once, on an empty data directory (docker-entrypoint-initdb.d).
# The kcs database is POSTGRES_DB; the TinyShip identity database sits next to it.
# pg_stat_statements is preloaded by the compose command line and lives in its own
# `monitoring` schema so the identity schema push never sees its views.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE DATABASE tinyship OWNER kcs;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA monitoring;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname tinyship <<'SQL'
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA monitoring;
SQL
