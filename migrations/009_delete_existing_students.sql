-- ============================================================
-- KAZZAZ: MIGRATION 009 — Delete all existing students
-- ============================================================
-- ONE-TIME CLEANUP: All students registered before the approved
-- scholars allowlist was implemented must be removed.
-- Run this AFTER 007 + 008.
-- ============================================================

-- Step 1: Delete shifts belonging to students
DELETE FROM shifts
WHERE user_id IN (SELECT id FROM profiles WHERE role = 'student');

-- Step 2: Delete manual logs belonging to students
DELETE FROM manual_logs
WHERE user_id IN (SELECT id FROM profiles WHERE role = 'student');

-- Step 3: Clean up used allowlist entries
DELETE FROM approved_scholars WHERE status = 'used';

-- Step 4: Delete student profiles (cascades to student_placements)
DELETE FROM profiles WHERE role = 'student';

-- Step 5: Delete orphaned auth.users (students no longer in profiles)
-- NOTE: This works in the Supabase SQL Editor which runs with service role.
-- If running via a migration tool without service role access, skip this step
-- and manually delete users from the Supabase Authentication dashboard.
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- ─── Reload PostgREST schema cache ───
NOTIFY pgrst, 'reload schema';
