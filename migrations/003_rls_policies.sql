-- ============================================================
-- KAZZAZ: MIGRATION 003 — RLS Policies
-- ============================================================
-- Run this AFTER 002_alter_existing_tables.sql
-- ============================================================

-- ═══ SITES ═══
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sites_select_authenticated"
  ON sites FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "sites_select_admin"
  ON sites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sites_insert_admin"
  ON sites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sites_update_admin"
  ON sites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sites_delete_admin"
  ON sites FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══ SITE SUPERVISORS ═══
ALTER TABLE site_supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_supervisors_select_own"
  ON site_supervisors FOR SELECT TO authenticated
  USING (supervisor_id = auth.uid());

CREATE POLICY "site_supervisors_select_admin"
  ON site_supervisors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "site_supervisors_insert_admin"
  ON site_supervisors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "site_supervisors_update_admin"
  ON site_supervisors FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "site_supervisors_delete_admin"
  ON site_supervisors FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══ STUDENT PLACEMENTS ═══
ALTER TABLE student_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placements_select_own"
  ON student_placements FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "placements_select_supervisor"
  ON student_placements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_supervisors ss
      WHERE ss.supervisor_id = auth.uid()
        AND ss.site_id = student_placements.site_id
    )
  );

CREATE POLICY "placements_select_admin"
  ON student_placements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "placements_insert_admin"
  ON student_placements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "placements_update_admin"
  ON student_placements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "placements_delete_admin"
  ON student_placements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══ GENERAL EVENTS ═══
ALTER TABLE general_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_authenticated"
  ON general_events FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "events_select_admin"
  ON general_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "events_insert_admin"
  ON general_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "events_update_admin"
  ON general_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "events_delete_admin"
  ON general_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══ MANUAL LOGS — New policies for supervisor access ═══

CREATE POLICY "manual_logs_select_supervisor"
  ON manual_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_supervisors ss
      WHERE ss.supervisor_id = auth.uid()
        AND ss.site_id = manual_logs.site_id
    )
  );

CREATE POLICY "manual_logs_update_supervisor"
  ON manual_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_supervisors ss
      WHERE ss.supervisor_id = auth.uid()
        AND ss.site_id = manual_logs.site_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM site_supervisors ss
      WHERE ss.supervisor_id = auth.uid()
        AND ss.site_id = manual_logs.site_id
    )
  );

-- ═══ SHIFTS — New policy for supervisor read access ═══

CREATE POLICY "shifts_select_supervisor"
  ON shifts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM site_supervisors ss
      WHERE ss.supervisor_id = auth.uid()
        AND ss.site_id = shifts.site_id
    )
  );
