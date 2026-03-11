-- ============================================================
-- KAZZAZ: MIGRATION 007 — Add is_active to profiles
-- ============================================================
-- Run this AFTER 006_approved_scholars.sql
-- Adds the ability for admin to deactivate student accounts.
-- ============================================================

-- ─── 1. Add is_active column (all existing users default to active) ───
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ─── 2. Partial index for faster active-user queries ───
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active) WHERE is_active = true;

-- ─── 3. RLS: allow admin to update profiles (for toggling is_active) ───
-- First ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_admin'
  ) THEN
    CREATE POLICY "profiles_update_admin"
      ON profiles FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Also ensure self-read policy exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own"
      ON profiles FOR SELECT TO authenticated
      USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'site_supervisor')));
  END IF;
END $$;

-- ─── 4. Update handle_new_user trigger to include is_active ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email, total_goal, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.email,
    150,
    true
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
