-- Migration: Add force_password_reset column to users table
BEGIN;

SET search_path TO fswm, public;

ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
