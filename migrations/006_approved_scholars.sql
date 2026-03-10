-- ============================================================
-- KAZZAZ: MIGRATION 006 — Approved Scholars Allowlist
-- ============================================================
-- Run this AFTER 005_update_trigger.sql
-- Creates the approved_scholars table, RLS, RPC, and updates trigger.
-- ============================================================

-- ─── 1. Create approved_scholars table ───
CREATE TABLE IF NOT EXISTS approved_scholars (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'used')),
  added_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approved_scholars_email ON approved_scholars(email);
CREATE INDEX IF NOT EXISTS idx_approved_scholars_status ON approved_scholars(status);

-- ─── 2. RLS policies — admin-only CRUD ───
ALTER TABLE approved_scholars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_scholars_select_admin"
  ON approved_scholars FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "approved_scholars_insert_admin"
  ON approved_scholars FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "approved_scholars_update_admin"
  ON approved_scholars FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "approved_scholars_delete_admin"
  ON approved_scholars FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 3. RPC: check_approved_email (callable by anon, SECURITY DEFINER) ───
CREATE OR REPLACE FUNCTION check_approved_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM approved_scholars
    WHERE lower(email) = lower(p_email)
      AND status = 'pending'
  );
END;
$$;

-- Grant execute to anon role so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION check_approved_email(text) TO anon;

-- ─── 4. Update handle_new_user trigger to mark email as used ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email, total_goal)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.email,
    150
  );

  -- Mark email as used in approved_scholars (no-op if not present)
  UPDATE public.approved_scholars
  SET status = 'used', used_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Reload PostgREST schema cache ───
NOTIFY pgrst, 'reload schema';
