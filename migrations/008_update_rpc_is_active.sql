-- ============================================================
-- KAZZAZ: MIGRATION 008 — Update RPCs to expose is_active
-- ============================================================
-- Run this AFTER 007_add_is_active.sql
-- Updates get_all_students_summary to include is_active.
-- Updates get_supervisor_students to filter out inactive students.
-- ============================================================

-- Must DROP first because return type is changing
DROP FUNCTION IF EXISTS get_all_students_summary();

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
  site_id uuid,
  is_active boolean
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
    sp.site_id,
    p.is_active
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
  ORDER BY p.is_active DESC, p.full_name;
$$;

-- ─── Update get_supervisor_students to exclude inactive students ───
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
    AND p.is_active = true
  ORDER BY p.full_name;
$$;

-- ─── Reload PostgREST schema cache ───
NOTIFY pgrst, 'reload schema';
