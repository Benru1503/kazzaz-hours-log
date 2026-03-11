-- ============================================================
-- KAZZAZ: MIGRATION 011 — Fix all admin RLS policies
-- ============================================================
-- Migration 010 created is_admin() / is_privileged() helper
-- functions with SECURITY DEFINER to avoid RLS recursion on
-- profiles. But 20 policies on OTHER tables still use the old
-- raw subquery (EXISTS SELECT 1 FROM profiles …), which now
-- goes through profiles RLS and can hang.
--
-- This migration replaces all 20 policies to use the helpers.
-- ============================================================

-- ═══ SITES (4 policies) ═══

DROP POLICY IF EXISTS "sites_select_admin"   ON sites;
DROP POLICY IF EXISTS "sites_insert_admin"   ON sites;
DROP POLICY IF EXISTS "sites_update_admin"   ON sites;
DROP POLICY IF EXISTS "sites_delete_admin"   ON sites;

CREATE POLICY "sites_select_admin"
  ON sites FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "sites_insert_admin"
  ON sites FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "sites_update_admin"
  ON sites FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "sites_delete_admin"
  ON sites FOR DELETE TO authenticated
  USING (public.is_admin());

-- ═══ SITE SUPERVISORS (4 policies) ═══

DROP POLICY IF EXISTS "site_supervisors_select_admin"   ON site_supervisors;
DROP POLICY IF EXISTS "site_supervisors_insert_admin"   ON site_supervisors;
DROP POLICY IF EXISTS "site_supervisors_update_admin"   ON site_supervisors;
DROP POLICY IF EXISTS "site_supervisors_delete_admin"   ON site_supervisors;

CREATE POLICY "site_supervisors_select_admin"
  ON site_supervisors FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "site_supervisors_insert_admin"
  ON site_supervisors FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "site_supervisors_update_admin"
  ON site_supervisors FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "site_supervisors_delete_admin"
  ON site_supervisors FOR DELETE TO authenticated
  USING (public.is_admin());

-- ═══ STUDENT PLACEMENTS (4 policies) ═══

DROP POLICY IF EXISTS "placements_select_admin"   ON student_placements;
DROP POLICY IF EXISTS "placements_insert_admin"   ON student_placements;
DROP POLICY IF EXISTS "placements_update_admin"   ON student_placements;
DROP POLICY IF EXISTS "placements_delete_admin"   ON student_placements;

CREATE POLICY "placements_select_admin"
  ON student_placements FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "placements_insert_admin"
  ON student_placements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "placements_update_admin"
  ON student_placements FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "placements_delete_admin"
  ON student_placements FOR DELETE TO authenticated
  USING (public.is_admin());

-- ═══ GENERAL EVENTS (4 policies) ═══

DROP POLICY IF EXISTS "events_select_admin"   ON general_events;
DROP POLICY IF EXISTS "events_insert_admin"   ON general_events;
DROP POLICY IF EXISTS "events_update_admin"   ON general_events;
DROP POLICY IF EXISTS "events_delete_admin"   ON general_events;

CREATE POLICY "events_select_admin"
  ON general_events FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "events_insert_admin"
  ON general_events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "events_update_admin"
  ON general_events FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "events_delete_admin"
  ON general_events FOR DELETE TO authenticated
  USING (public.is_admin());

-- ═══ APPROVED SCHOLARS (4 policies) ═══

DROP POLICY IF EXISTS "approved_scholars_select_admin"   ON approved_scholars;
DROP POLICY IF EXISTS "approved_scholars_insert_admin"   ON approved_scholars;
DROP POLICY IF EXISTS "approved_scholars_update_admin"   ON approved_scholars;
DROP POLICY IF EXISTS "approved_scholars_delete_admin"   ON approved_scholars;

CREATE POLICY "approved_scholars_select_admin"
  ON approved_scholars FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "approved_scholars_insert_admin"
  ON approved_scholars FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "approved_scholars_update_admin"
  ON approved_scholars FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "approved_scholars_delete_admin"
  ON approved_scholars FOR DELETE TO authenticated
  USING (public.is_admin());

-- ═══ Reload PostgREST schema cache ═══
NOTIFY pgrst, 'reload schema';
