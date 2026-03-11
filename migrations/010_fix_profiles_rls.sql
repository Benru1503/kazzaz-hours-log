-- ============================================================
-- KAZZAZ: MIGRATION 010 — Fix profiles RLS (self-referencing)
-- ============================================================
-- Migration 007 enabled RLS on profiles and created policies
-- that reference the profiles table inside their USING clauses.
-- This causes RLS recursion — the inner query is also subject
-- to RLS, which can block access entirely.
--
-- FIX: Use SECURITY DEFINER helper functions that bypass RLS
-- for the role check, then reference those functions in policies.
-- ============================================================

-- ─── 1. Helper functions (SECURITY DEFINER = bypasses RLS) ───

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_privileged()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'site_supervisor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 2. Drop ALL existing profiles policies (clean slate) ───

DROP POLICY IF EXISTS "select_own_profile"     ON profiles;
DROP POLICY IF EXISTS "update_own_profile"     ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin"  ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"    ON profiles;

-- ─── 3. Ensure RLS is enabled ───

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ─── 4. Recreate policies using helper functions ───

-- SELECT: every authenticated user can read own profile;
-- admin and supervisor can read all profiles
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_privileged());

-- UPDATE: users can update their own profile;
-- admin can update any profile (for toggling is_active, etc.)
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- INSERT: only the trigger (SECURITY DEFINER) inserts profiles,
-- but allow it explicitly for safety
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ─── 5. Reload PostgREST schema cache ───
NOTIFY pgrst, 'reload schema';
