-- ============================================================
-- KAZZAZ: PROMOTE USER TO ADMIN
-- ============================================================
-- Run this in Supabase SQL Editor.
-- Replace the email below with the one you want to promote.
-- ============================================================

-- Step 1: Promote by email
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'REPLACE-WITH-EMAIL@example.com'
);

-- Step 2: Verify it worked
SELECT
  p.id,
  p.full_name,
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';

-- ============================================================
-- USEFUL QUERIES FOR DEBUGGING
-- ============================================================

-- See all users and their roles:
-- SELECT p.full_name, p.role, u.email, p.created_at
-- FROM profiles p
-- JOIN auth.users u ON u.id = p.id
-- ORDER BY p.created_at;

-- Manually confirm unverified email:
-- UPDATE auth.users
-- SET email_confirmed_at = now()
-- WHERE email = 'REPLACE-WITH-EMAIL@example.com';

-- Reset a user back to student:
-- UPDATE profiles
-- SET role = 'student'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'REPLACE-WITH-EMAIL@example.com');