BEGIN;

CREATE SCHEMA IF NOT EXISTS fswm;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMENT ON SCHEMA fswm IS 'Faculty Scheduling and Workload Management System schema.';

COMMIT;

