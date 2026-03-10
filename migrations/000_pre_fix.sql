-- ============================================================
-- KAZZAZ: PRE-FIX — Run this BEFORE the other migrations
-- Fixes: enum type, existing function signature
-- ============================================================

-- 1. Add 'site_supervisor' to the existing user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'site_supervisor';

-- 2. Drop existing function that has a different return type
-- (CREATE OR REPLACE can't change return types, so we drop first)
DROP FUNCTION IF EXISTS get_all_students_summary();
