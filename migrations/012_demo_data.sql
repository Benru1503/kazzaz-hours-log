-- ============================================================
-- KAZZAZ: MIGRATION 012 — Demo Data for Full Workflow
-- ============================================================
-- Creates: 2 sites, 1 supervisor, 3 students, placements,
-- shifts, and manual logs in various states.
--
-- LOGIN CREDENTIALS:
--   Supervisor:  supervisor@kazzaz.demo  /  Demo1234!
--   Student 1:   yossi@kazzaz.demo       /  Demo1234!
--   Student 2:   sara@kazzaz.demo        /  Demo1234!
--   Student 3:   noam@kazzaz.demo        /  Demo1234!
-- ============================================================

-- ═══ Fixed UUIDs for referencing ═══
DO $$
DECLARE
  -- Sites
  v_site_school   uuid := 'a0000000-0000-0000-0000-000000000001';
  v_site_community uuid := 'a0000000-0000-0000-0000-000000000002';

  -- Users
  v_supervisor    uuid := 'b0000000-0000-0000-0000-000000000001';
  v_student1      uuid := 'c0000000-0000-0000-0000-000000000001';
  v_student2      uuid := 'c0000000-0000-0000-0000-000000000002';
  v_student3      uuid := 'c0000000-0000-0000-0000-000000000003';

  -- Admin (assume the existing admin is the one who set everything up)
  v_admin         uuid;

  v_pw_hash       text;

BEGIN
  -- ─── Find existing admin ───
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- ─── Hash the demo password once ───
  v_pw_hash := crypt('Demo1234!', gen_salt('bf'));

  -- ══════════════════════════════════════════
  -- 1. SITES
  -- ══════════════════════════════════════════
  INSERT INTO sites (id, name, address, description, is_active)
  VALUES
    (v_site_school,    'בית ספר הדר',     'רחוב הגפן 12, חיפה',     'בית ספר יסודי — חונכות ותגבור לימודי',         true),
    (v_site_community, 'מרכז קהילתי אור', 'שדרות רוטשילד 45, תל אביב', 'מרכז קהילתי — פעילויות חברתיות והתנדבות', true)
  ON CONFLICT (id) DO NOTHING;

  -- ══════════════════════════════════════════
  -- 2. SUPERVISOR AUTH USER + PROFILE
  -- ══════════════════════════════════════════
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_supervisor, 'authenticated', 'authenticated',
    'supervisor@kazzaz.demo',
    v_pw_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"דוד כהן","role":"site_supervisor"}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- Identity record (required for Supabase v2 login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_supervisor, v_supervisor,
    jsonb_build_object('sub', v_supervisor::text, 'email', 'supervisor@kazzaz.demo'),
    'email', v_supervisor::text,
    now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  -- Profile (trigger may have fired, but insert if not)
  INSERT INTO public.profiles (id, full_name, role, email, total_goal, is_active)
  VALUES (v_supervisor, 'דוד כהן', 'site_supervisor', 'supervisor@kazzaz.demo', 150, true)
  ON CONFLICT (id) DO NOTHING;

  -- Assign supervisor to both sites
  INSERT INTO site_supervisors (supervisor_id, site_id)
  VALUES
    (v_supervisor, v_site_school),
    (v_supervisor, v_site_community)
  ON CONFLICT (supervisor_id, site_id) DO NOTHING;

  -- ══════════════════════════════════════════
  -- 3. STUDENT AUTH USERS + PROFILES
  -- ══════════════════════════════════════════

  -- ── Student 1: יוסי לוי ──
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_student1, 'authenticated', 'authenticated',
    'yossi@kazzaz.demo',
    v_pw_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"יוסי לוי","role":"student"}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_student1, v_student1,
    jsonb_build_object('sub', v_student1::text, 'email', 'yossi@kazzaz.demo'),
    'email', v_student1::text,
    now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, full_name, role, email, total_goal, is_active)
  VALUES (v_student1, 'יוסי לוי', 'student', 'yossi@kazzaz.demo', 150, true)
  ON CONFLICT (id) DO NOTHING;

  -- ── Student 2: שרה אברהם ──
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_student2, 'authenticated', 'authenticated',
    'sara@kazzaz.demo',
    v_pw_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"שרה אברהם","role":"student"}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_student2, v_student2,
    jsonb_build_object('sub', v_student2::text, 'email', 'sara@kazzaz.demo'),
    'email', v_student2::text,
    now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, full_name, role, email, total_goal, is_active)
  VALUES (v_student2, 'שרה אברהם', 'student', 'sara@kazzaz.demo', 150, true)
  ON CONFLICT (id) DO NOTHING;

  -- ── Student 3: נועם גולן ──
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_student3, 'authenticated', 'authenticated',
    'noam@kazzaz.demo',
    v_pw_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"נועם גולן","role":"student"}',
    now(), now(), '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_student3, v_student3,
    jsonb_build_object('sub', v_student3::text, 'email', 'noam@kazzaz.demo'),
    'email', v_student3::text,
    now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, full_name, role, email, total_goal, is_active)
  VALUES (v_student3, 'נועם גולן', 'student', 'noam@kazzaz.demo', 150, true)
  ON CONFLICT (id) DO NOTHING;

  -- Mark demo emails as "used" in approved_scholars
  INSERT INTO approved_scholars (email, status, added_by, used_at)
  VALUES
    ('yossi@kazzaz.demo', 'used', v_admin, now()),
    ('sara@kazzaz.demo',  'used', v_admin, now()),
    ('noam@kazzaz.demo',  'used', v_admin, now())
  ON CONFLICT (email) DO NOTHING;

  -- ══════════════════════════════════════════
  -- 4. STUDENT PLACEMENTS
  -- ══════════════════════════════════════════
  INSERT INTO student_placements (student_id, site_id, academic_year, status)
  VALUES
    (v_student1, v_site_school,    '2025-2026', 'active'),  -- יוסי → בית ספר הדר
    (v_student2, v_site_school,    '2025-2026', 'active'),  -- שרה → בית ספר הדר
    (v_student3, v_site_community, '2025-2026', 'active')   -- נועם → מרכז קהילתי אור
  ON CONFLICT (student_id, academic_year) DO NOTHING;

  -- ══════════════════════════════════════════
  -- 5. SHIFTS (completed — count toward hours)
  -- ══════════════════════════════════════════

  -- ── יוסי לוי: ~65 shift hours ──
  INSERT INTO shifts (user_id, start_time, end_time, status, task_description, category, duration_minutes, site_id) VALUES
    (v_student1, '2025-11-10 08:00:00+02', '2025-11-10 12:00:00+02', 'completed', 'חונכות מתמטיקה כיתה ה', 'other', 240, v_site_school),
    (v_student1, '2025-11-17 08:00:00+02', '2025-11-17 12:30:00+02', 'completed', 'תגבור קריאה כיתה ג',   'other', 270, v_site_school),
    (v_student1, '2025-11-24 08:00:00+02', '2025-11-24 12:00:00+02', 'completed', 'חונכות מתמטיקה כיתה ה', 'other', 240, v_site_school),
    (v_student1, '2025-12-01 08:00:00+02', '2025-12-01 13:00:00+02', 'completed', 'הכנה למבחן — כיתה ו',   'other', 300, v_site_school),
    (v_student1, '2025-12-08 08:00:00+02', '2025-12-08 12:00:00+02', 'completed', 'חונכות אנגלית כיתה ד',  'other', 240, v_site_school),
    (v_student1, '2025-12-15 08:00:00+02', '2025-12-15 12:00:00+02', 'completed', 'תגבור מתמטיקה כיתה ה',  'other', 240, v_site_school),
    (v_student1, '2025-12-22 08:00:00+02', '2025-12-22 11:30:00+02', 'completed', 'חונכות קריאה כיתה ב',   'other', 210, v_site_school),
    (v_student1, '2026-01-05 08:00:00+02', '2026-01-05 12:00:00+02', 'completed', 'סיוע בשיעורי בית',       'other', 240, v_site_school),
    (v_student1, '2026-01-12 08:00:00+02', '2026-01-12 12:00:00+02', 'completed', 'חונכות מתמטיקה כיתה ה', 'other', 240, v_site_school),
    (v_student1, '2026-01-19 08:00:00+02', '2026-01-19 13:00:00+02', 'completed', 'הכנה לבגרות — עברית',    'other', 300, v_site_school),
    (v_student1, '2026-02-02 08:00:00+02', '2026-02-02 12:00:00+02', 'completed', 'חונכות מדעים כיתה ו',   'other', 240, v_site_school),
    (v_student1, '2026-02-09 08:00:00+02', '2026-02-09 11:00:00+02', 'completed', 'תגבור אנגלית כיתה ה',   'other', 180, v_site_school),
    (v_student1, '2026-02-23 08:00:00+02', '2026-02-23 12:00:00+02', 'completed', 'חונכות מתמטיקה כיתה ה', 'other', 240, v_site_school),
    (v_student1, '2026-03-02 08:00:00+02', '2026-03-02 12:30:00+02', 'completed', 'הכנה למבחן מדעים',       'other', 270, v_site_school);

  -- ── שרה אברהם: ~35 shift hours ──
  INSERT INTO shifts (user_id, start_time, end_time, status, task_description, category, duration_minutes, site_id) VALUES
    (v_student2, '2025-12-01 09:00:00+02', '2025-12-01 12:00:00+02', 'completed', 'חונכות אנגלית כיתה ג', 'other', 180, v_site_school),
    (v_student2, '2025-12-08 09:00:00+02', '2025-12-08 12:30:00+02', 'completed', 'תגבור קריאה כיתה ד',   'other', 210, v_site_school),
    (v_student2, '2025-12-15 09:00:00+02', '2025-12-15 13:00:00+02', 'completed', 'סיוע בספרייה',           'other', 240, v_site_school),
    (v_student2, '2026-01-05 09:00:00+02', '2026-01-05 12:00:00+02', 'completed', 'חונכות מתמטיקה כיתה ג', 'other', 180, v_site_school),
    (v_student2, '2026-01-12 09:00:00+02', '2026-01-12 12:00:00+02', 'completed', 'תגבור עברית כיתה ד',    'other', 180, v_site_school),
    (v_student2, '2026-01-26 09:00:00+02', '2026-01-26 13:00:00+02', 'completed', 'הכנה למבחן — כיתה ד',   'other', 240, v_site_school),
    (v_student2, '2026-02-02 09:00:00+02', '2026-02-02 12:00:00+02', 'completed', 'חונכות אנגלית כיתה ג',  'other', 180, v_site_school),
    (v_student2, '2026-02-16 09:00:00+02', '2026-02-16 12:30:00+02', 'completed', 'סיוע בשיעורי בית',       'other', 210, v_site_school),
    (v_student2, '2026-03-02 09:00:00+02', '2026-03-02 12:30:00+02', 'completed', 'חונכות קריאה כיתה ג',   'other', 210, v_site_school);

  -- ── נועם גולן: ~12 shift hours ──
  INSERT INTO shifts (user_id, start_time, end_time, status, task_description, category, duration_minutes, site_id) VALUES
    (v_student3, '2026-02-09 14:00:00+02', '2026-02-09 17:00:00+02', 'completed', 'סיוע בחלוקת מזון',       'other', 180, v_site_community),
    (v_student3, '2026-02-16 14:00:00+02', '2026-02-16 18:00:00+02', 'completed', 'הפעלה לקשישים',          'other', 240, v_site_community),
    (v_student3, '2026-02-23 14:00:00+02', '2026-02-23 17:30:00+02', 'completed', 'סדנת מחשבים לגיל השלישי', 'other', 210, v_site_community),
    (v_student3, '2026-03-02 14:00:00+02', '2026-03-02 16:00:00+02', 'completed', 'סיוע בארגון אירוע קהילתי', 'other', 120, v_site_community);

  -- ══════════════════════════════════════════
  -- 6. MANUAL LOGS (various statuses for demo)
  -- ══════════════════════════════════════════

  -- ── יוסי: 15h approved manual + 2 pending for supervisor ──
  INSERT INTO manual_logs (user_id, date, duration_minutes, description, category, status, supervisor_status, site_id, reviewed_by, reviewed_at, supervisor_reviewed_by, supervisor_reviewed_at) VALUES
    -- Fully approved (counted toward hours)
    (v_student1, '2025-11-14', 180, 'הכנת חומרי לימוד לכיתה ה',   'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2025-11-16 10:00:00+02', v_supervisor, '2025-11-15 09:00:00+02'),
    (v_student1, '2025-12-05', 120, 'ישיבת צוות חונכים',            'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2025-12-07 10:00:00+02', v_supervisor, '2025-12-06 09:00:00+02'),
    (v_student1, '2026-01-09', 180, 'הכנת חומרים למבחן מתמטיקה',   'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-01-11 10:00:00+02', v_supervisor, '2026-01-10 09:00:00+02'),
    (v_student1, '2026-02-06', 120, 'ישיבת תכנון סמסטר ב',          'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-02-08 10:00:00+02', v_supervisor, '2026-02-07 09:00:00+02'),
    (v_student1, '2026-02-20', 300, 'אירוע מיוחד — יום פתוח בבית הספר', 'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-02-22 10:00:00+02', v_supervisor, '2026-02-21 09:00:00+02'),

    -- Pending supervisor approval (supervisor sees these)
    (v_student1, '2026-03-07', 180, 'הכנת שיעור מתמטיקה מיוחד',    'other', 'pending', 'pending_supervisor', v_site_school, NULL, NULL, NULL, NULL),
    (v_student1, '2026-03-09', 120, 'ליווי תלמיד לפגישה עם יועצת', 'other', 'pending', 'pending_supervisor', v_site_school, NULL, NULL, NULL, NULL);

  -- ── שרה: 10h approved manual + 1 pending supervisor + 1 supervisor_approved waiting admin ──
  INSERT INTO manual_logs (user_id, date, duration_minutes, description, category, status, supervisor_status, site_id, reviewed_by, reviewed_at, supervisor_reviewed_by, supervisor_reviewed_at) VALUES
    -- Fully approved
    (v_student2, '2025-12-12', 120, 'הכנת עזרי הוראה',              'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2025-12-14 10:00:00+02', v_supervisor, '2025-12-13 09:00:00+02'),
    (v_student2, '2026-01-16', 180, 'סדנת קריאה לכיתה ג',          'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-01-18 10:00:00+02', v_supervisor, '2026-01-17 09:00:00+02'),
    (v_student2, '2026-02-13', 120, 'ישיבת צוות חונכים',            'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-02-15 10:00:00+02', v_supervisor, '2026-02-14 09:00:00+02'),
    (v_student2, '2026-02-27', 180, 'הכנת חומרים לפורים',           'other', 'approved', 'supervisor_approved', v_site_school, v_admin, '2026-03-01 10:00:00+02', v_supervisor, '2026-02-28 09:00:00+02'),

    -- Supervisor approved, waiting admin final approval
    (v_student2, '2026-03-06', 150, 'ליווי טיול כיתה ד',            'other', 'pending', 'supervisor_approved', v_site_school, NULL, NULL, v_supervisor, '2026-03-07 09:00:00+02'),

    -- Pending supervisor approval
    (v_student2, '2026-03-10', 120, 'תגבור שיעורי בית אחה״צ',      'other', 'pending', 'pending_supervisor', v_site_school, NULL, NULL, NULL, NULL);

  -- ── נועם: 3h approved manual + 2 pending supervisor ──
  INSERT INTO manual_logs (user_id, date, duration_minutes, description, category, status, supervisor_status, site_id, reviewed_by, reviewed_at, supervisor_reviewed_by, supervisor_reviewed_at) VALUES
    -- Fully approved
    (v_student3, '2026-02-14', 180, 'ארגון מחסן ציוד למרכז',       'other', 'approved', 'supervisor_approved', v_site_community, v_admin, '2026-02-16 10:00:00+02', v_supervisor, '2026-02-15 09:00:00+02'),

    -- Pending supervisor approval
    (v_student3, '2026-03-06', 240, 'הפעלת ערב תרבות לקשישים',     'other', 'pending', 'pending_supervisor', v_site_community, NULL, NULL, NULL, NULL),
    (v_student3, '2026-03-08', 120, 'סיוע בחלוקת חבילות מזון',     'other', 'pending', 'pending_supervisor', v_site_community, NULL, NULL, NULL, NULL);

END $$;

-- ═══ Reload PostgREST schema cache ═══
NOTIFY pgrst, 'reload schema';
