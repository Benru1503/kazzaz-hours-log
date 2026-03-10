-- ═══════════════════════════════════════════════════════════════
-- Migration: Three-tier role system tables
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════

-- 1. Add role column to profiles (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN role text NOT NULL DEFAULT 'student'
      CHECK (role IN ('student', 'admin', 'site_supervisor'));
  END IF;
END $$;

-- 2. Sites table
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Everyone can read sites
CREATE POLICY IF NOT EXISTS "sites_select" ON public.sites
  FOR SELECT USING (true);

-- Only admins can insert/update/delete sites
CREATE POLICY IF NOT EXISTS "sites_admin_insert" ON public.sites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "sites_admin_update" ON public.sites
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "sites_admin_delete" ON public.sites
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. General events table
CREATE TABLE IF NOT EXISTS public.general_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.general_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "events_select" ON public.general_events
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "events_admin_insert" ON public.general_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "events_admin_update" ON public.general_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Site supervisors junction table
CREATE TABLE IF NOT EXISTS public.site_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supervisor_id, site_id)
);

ALTER TABLE public.site_supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "site_supervisors_select" ON public.site_supervisors
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "site_supervisors_admin_insert" ON public.site_supervisors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "site_supervisors_admin_delete" ON public.site_supervisors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Student placements table
CREATE TABLE IF NOT EXISTS public.student_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  academic_year text NOT NULL DEFAULT '2025-2026',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "placements_select" ON public.student_placements
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "placements_admin_insert" ON public.student_placements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "placements_admin_update" ON public.student_placements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Add new columns to manual_logs (if not exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manual_logs' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.manual_logs ADD COLUMN site_id uuid REFERENCES public.sites(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manual_logs' AND column_name = 'general_event_id'
  ) THEN
    ALTER TABLE public.manual_logs ADD COLUMN general_event_id uuid REFERENCES public.general_events(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manual_logs' AND column_name = 'supervisor_status'
  ) THEN
    ALTER TABLE public.manual_logs ADD COLUMN supervisor_status text DEFAULT NULL
      CHECK (supervisor_status IN ('pending_supervisor', 'supervisor_approved', 'supervisor_rejected'));
  END IF;
END $$;

-- 7. Add site_id to shifts (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.shifts ADD COLUMN site_id uuid REFERENCES public.sites(id);
  END IF;
END $$;

-- 8. RPC: Get supervisor's students with progress
CREATE OR REPLACE FUNCTION public.get_supervisor_students(p_supervisor_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  total_goal numeric,
  shift_hours numeric,
  approved_manual_hours numeric,
  total_hours numeric,
  progress_percent numeric,
  site_name text,
  site_id uuid,
  pending_supervisor_logs bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS student_id,
    p.full_name,
    150::numeric AS total_goal,
    COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END) / 60.0, 0) AS shift_hours,
    COALESCE(SUM(CASE WHEN ml.status = 'approved' THEN ml.duration_minutes ELSE 0 END) / 60.0, 0) AS approved_manual_hours,
    (COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0)
     + COALESCE(SUM(CASE WHEN ml.status = 'approved' THEN ml.duration_minutes ELSE 0 END), 0)) / 60.0 AS total_hours,
    LEAST(
      (COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0)
       + COALESCE(SUM(CASE WHEN ml.status = 'approved' THEN ml.duration_minutes ELSE 0 END), 0)) / 60.0 / 150.0 * 100,
      100
    ) AS progress_percent,
    si.name AS site_name,
    si.id AS site_id,
    (SELECT COUNT(*) FROM public.manual_logs ml2
     WHERE ml2.user_id = p.id AND ml2.supervisor_status = 'pending_supervisor') AS pending_supervisor_logs
  FROM public.student_placements sp
  JOIN public.profiles p ON p.id = sp.student_id
  JOIN public.sites si ON si.id = sp.site_id
  JOIN public.site_supervisors ss ON ss.site_id = sp.site_id
  LEFT JOIN public.shifts s ON s.user_id = p.id
  LEFT JOIN public.manual_logs ml ON ml.user_id = p.id
  WHERE ss.supervisor_id = p_supervisor_id
    AND sp.status = 'active'
  GROUP BY p.id, p.full_name, si.name, si.id;
END;
$$;

-- 9. RPC: Get supervisor's pending logs
CREATE OR REPLACE FUNCTION public.get_supervisor_pending_logs(p_supervisor_id uuid)
RETURNS TABLE (
  log_id uuid,
  student_name text,
  description text,
  category text,
  date date,
  duration_minutes integer,
  site_name text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id AS log_id,
    p.full_name AS student_name,
    ml.description,
    ml.category,
    ml.date,
    ml.duration_minutes,
    si.name AS site_name
  FROM public.manual_logs ml
  JOIN public.profiles p ON p.id = ml.user_id
  JOIN public.sites si ON si.id = ml.site_id
  JOIN public.site_supervisors ss ON ss.site_id = ml.site_id
  WHERE ss.supervisor_id = p_supervisor_id
    AND ml.supervisor_status = 'pending_supervisor'
  ORDER BY ml.created_at ASC;
END;
$$;

-- 10. RPC: Supervisor approve log
CREATE OR REPLACE FUNCTION public.supervisor_approve_log(p_log_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.manual_logs
  SET supervisor_status = 'supervisor_approved',
      status = 'pending'  -- now goes to admin for final approval
  WHERE id = p_log_id
    AND supervisor_status = 'pending_supervisor';
END;
$$;

-- 11. RPC: Supervisor reject log
CREATE OR REPLACE FUNCTION public.supervisor_reject_log(p_log_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.manual_logs
  SET supervisor_status = 'supervisor_rejected',
      status = 'rejected'
  WHERE id = p_log_id
    AND supervisor_status = 'pending_supervisor';
END;
$$;

-- 12. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
