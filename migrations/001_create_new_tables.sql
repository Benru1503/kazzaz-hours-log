-- ============================================================
-- KAZZAZ: MIGRATION 001 — Create New Tables
-- ============================================================
-- Run this in Supabase SQL Editor FIRST, before other migrations.
-- ============================================================

-- ─── Sites: Volunteering locations ───
CREATE TABLE IF NOT EXISTS sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_is_active ON sites(is_active) WHERE is_active = true;

-- ─── Site Supervisors: Links supervisors to their managed sites ───
CREATE TABLE IF NOT EXISTS site_supervisors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_site_supervisors_supervisor ON site_supervisors(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_site_supervisors_site ON site_supervisors(site_id);

-- ─── Student Placements: Links students to sites for a given academic year ───
CREATE TABLE IF NOT EXISTS student_placements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'withdrawn')),
  placed_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_placements_student ON student_placements(student_id);
CREATE INDEX IF NOT EXISTS idx_student_placements_site ON student_placements(site_id);
CREATE INDEX IF NOT EXISTS idx_student_placements_year ON student_placements(academic_year);

-- ─── General Events: Admin-created events not tied to any site ───
CREATE TABLE IF NOT EXISTS general_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  event_date  date,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_general_events_active ON general_events(is_active) WHERE is_active = true;
