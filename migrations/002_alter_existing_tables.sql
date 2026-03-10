-- ============================================================
-- KAZZAZ: MIGRATION 002 — Alter Existing Tables
-- ============================================================
-- Run this AFTER 001_create_new_tables.sql
-- ============================================================

-- ─── Profiles: add email cache + allow 'site_supervisor' role ───
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing emails from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

-- Update role constraint to include 'site_supervisor'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'admin', 'site_supervisor'));

-- ─── Shifts: link to site ───
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL;

-- ─── Manual Logs: link to site or event, add supervisor approval fields ───
ALTER TABLE manual_logs
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS general_event_id uuid REFERENCES general_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supervisor_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_reviewed_at timestamptz DEFAULT NULL;

-- Only add constraint if it doesn't exist (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manual_logs_supervisor_status_check'
  ) THEN
    ALTER TABLE manual_logs ADD CONSTRAINT manual_logs_supervisor_status_check
      CHECK (supervisor_status IS NULL OR supervisor_status IN ('pending_supervisor', 'supervisor_approved', 'supervisor_rejected'));
  END IF;
END $$;
