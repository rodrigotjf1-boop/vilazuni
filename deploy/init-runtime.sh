#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=runtime_password="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE vilazuni_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD :'runtime_password';
GRANT CONNECT ON DATABASE vilazuni TO vilazuni_app;
GRANT USAGE ON SCHEMA public TO vilazuni_app;
GRANT SELECT, INSERT, UPDATE ON vilazuni_control, vilazuni_tenants TO vilazuni_app;
SQL
