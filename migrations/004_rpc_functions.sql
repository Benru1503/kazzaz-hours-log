-- ============================================================
-- KAZZAZ: MIGRATION 004 — RPC Functions
-- ============================================================
-- Run this AFTER 003_rls_policies.sql
-- ============================================================

-- ─── Updated: get_all_students_summary (with site info) ───
CREATE OR REPLACE FUNCTION get_all_students_summary()
RETURNS TABLE (
  student_id uuid,
  full_name text,
  total_goal integer,
  shift_hours numeric,
  approved_manual_hours numeric,
  pending_logs bigint,
  total_hours numeric,
  progress_percent numeric,
  site_name text,
  site_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id AS student_id,
    p.full_name,
    p.total_goal,
    COALESCE(sh.shift_hours, 0) AS shift_hours,
    COALESCE(ml.approved_hours, 0) AS approved_manual_hours,
    COALESCE(ml.pending_count, 0) AS pending_logs,
    COALESCE(sh.shift_hours, 0) + COALESCE(ml.approved_hours, 0) AS total_hours,
    LEAST(
      (COALESCE(sh.shift_hours, 0) + COALESCE(ml.approved_hours, 0)) / GREATEST(p.total_goal, 1) * 100,
      100
    ) AS progress_percent,
    s.name AS site_name,
    sp.site_id
  FROM profiles p
  LEFT JOIN (
    SELECT user_id,
           SUM(duration_minutes) / 60.0 AS shift_hours
    FROM shifts
    WHERE status = 'completed' AND duration_minutes IS NOT NULL
    GROUP BY user_id
  ) sh ON sh.user_id = p.id
  LEFT JOIN (
    SELECT user_id,
           SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) / 60.0 AS approved_hours,
           COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count
    FROM manual_logs
    GROUP BY user_id
  ) ml ON ml.user_id = p.id
  LEFT JOIN student_placements sp ON sp.student_id = p.id AND sp.status = 'active'
  LEFT JOIN sites s ON s.id = sp.site_id
  WHERE p.role = 'student'
  ORDER BY p.full_name;
$$;

-- ─── New: get_supervisor_students ───
CREATE OR REPLACE FUNCTION get_supervisor_students(p_supervisor_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  total_goal integer,
  site_name text,
  site_id uuid,
  shift_hours numeric,
  approved_manual_hours numeric,
  pending_supervisor_logs bigint,
  total_hours numeric,
  progress_percent numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id AS student_id,
    p.full_name,
    p.total_goal,
    si.name AS site_name,
    sp.site_id,
    COALESCE(sh.shift_hours, 0) AS shift_hours,
    COALESCE(ml.approved_hours, 0) AS approved_manual_hours,
    COALESCE(ml.pending_sup_count, 0) AS pending_supervisor_logs,
    COALESCE(sh.shift_hours, 0) + COALESCE(ml.approved_hours, 0) AS total_hours,
    LEAST(
      (COALESCE(sh.shift_hours, 0) + COALESCE(ml.approved_hours, 0)) / GREATEST(p.total_goal, 1) * 100,
      100
    ) AS progress_percent
  FROM profiles p
  INNER JOIN student_placements sp ON sp.student_id = p.id AND sp.status = 'active'
  INNER JOIN site_supervisors ss ON ss.site_id = sp.site_id AND ss.supervisor_id = p_supervisor_id
  INNER JOIN sites si ON si.id = sp.site_id
  LEFT JOIN (
    SELECT user_id,
           SUM(duration_minutes) / 60.0 AS shift_hours
    FROM shifts
    WHERE status = 'completed' AND duration_minutes IS NOT NULL
    GROUP BY user_id
  ) sh ON sh.user_id = p.id
  LEFT JOIN (
    SELECT user_id,
           SUM(CASE WHEN status = 'approved' THEN duration_minutes ELSE 0 END) / 60.0 AS approved_hours,
           COUNT(CASE WHEN supervisor_status = 'pending_supervisor' THEN 1 END) AS pending_sup_count
    FROM manual_logs
    GROUP BY user_id
  ) ml ON ml.user_id = p.id
  WHERE p.role = 'student'
  ORDER BY p.full_name;
$$;

-- ─── New: get_supervisor_pending_logs ───
CREATE OR REPLACE FUNCTION get_supervisor_pending_logs(p_supervisor_id uuid)
RETURNS TABLE (
  log_id uuid,
  student_name text,
  student_id uuid,
  site_name text,
  date date,
  duration_minutes integer,
  description text,
  category text,
  created_at timestamptz,
  supervisor_status text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    ml.id AS log_id,
    p.full_name AS student_name,
    ml.user_id AS student_id,
    si.name AS site_name,
    ml.date,
    ml.duration_minutes,
    ml.description,
    ml.category,
    ml.created_at,
    ml.supervisor_status
  FROM manual_logs ml
  INNER JOIN profiles p ON p.id = ml.user_id
  INNER JOIN site_supervisors ss ON ss.site_id = ml.site_id AND ss.supervisor_id = p_supervisor_id
  INNER JOIN sites si ON si.id = ml.site_id
  WHERE ml.supervisor_status = 'pending_supervisor'
  ORDER BY ml.created_at ASC;
$$;

-- ─── New: supervisor_approve_log ───
CREATE OR REPLACE FUNCTION supervisor_approve_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE manual_logs
  SET
    supervisor_status = 'supervisor_approved',
    supervisor_reviewed_by = auth.uid(),
    supervisor_reviewed_at = now()
  WHERE id = p_log_id
    AND supervisor_status = 'pending_supervisor'
    AND site_id IN (
      SELECT site_id FROM site_supervisors WHERE supervisor_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log not found or not authorized';
  END IF;
END;
$$;

-- ─── New: supervisor_reject_log ───
CREATE OR REPLACE FUNCTION supervisor_reject_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE manual_logs
  SET
    supervisor_status = 'supervisor_rejected',
    supervisor_reviewed_by = auth.uid(),
    supervisor_reviewed_at = now(),
    status = 'rejected'
  WHERE id = p_log_id
    AND supervisor_status = 'pending_supervisor'
    AND site_id IN (
      SELECT site_id FROM site_supervisors WHERE supervisor_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log not found or not authorized';
  END IF;
END;
$$;
