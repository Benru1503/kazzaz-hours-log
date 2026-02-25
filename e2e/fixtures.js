/**
 * Playwright fixtures with Supabase API mocking.
 *
 * Every E2E test imports { test, expect } from this file instead of
 * '@playwright/test'.  The custom `page` fixture intercepts all
 * requests to the Supabase domain so that tests never hit the real
 * backend — no network dependency, no timeout, deterministic data.
 */

import { test as base, expect } from '@playwright/test';

// ─── Fake IDs & tokens ───
const STUDENT_UID  = 'e2e-student-uid-001';
const ADMIN_UID    = 'e2e-admin-uid-001';
const STUDENT_TOKEN = 'e2e-student-access-token';
const ADMIN_TOKEN   = 'e2e-admin-access-token';

// ─── Credentials that match e2e/helpers.js defaults ───
const STUDENT_EMAIL = 'student@test.com';
const STUDENT_PW    = 'test123456';
const ADMIN_EMAIL   = 'admin@test.com';
const ADMIN_PW      = 'admin123456';

// ─── Mock data (mirrors src/__mocks__/supabase.js factories) ───
const STUDENT_PROFILE = {
  id: STUDENT_UID,
  full_name: 'ישראל ישראלי',
  role: 'student',
  total_goal: 150,
  created_at: '2026-01-01T00:00:00Z',
};

const ADMIN_PROFILE = {
  id: ADMIN_UID,
  full_name: 'מנהל מערכת',
  role: 'admin',
  total_goal: 150,
  created_at: '2026-01-01T00:00:00Z',
};

const SAMPLE_SHIFT = {
  id: 'shift-001',
  user_id: STUDENT_UID,
  start_time: '2026-02-17T08:00:00Z',
  end_time: '2026-02-17T12:00:00Z',
  status: 'completed',
  task_description: 'חונכות מתמטיקה',
  category: 'tutoring',
  duration_minutes: 240,
  created_at: '2026-02-17T08:00:00Z',
};

const SAMPLE_MANUAL_LOG = {
  id: 'log-001',
  user_id: STUDENT_UID,
  date: '2026-02-15',
  duration_minutes: 180,
  description: 'סיוע בספרייה',
  category: 'community_service',
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-02-15T10:00:00Z',
};

const STUDENT_SUMMARY = {
  student_id: STUDENT_UID,
  full_name: 'ישראל ישראלי',
  total_goal: 150,
  shift_hours: 45.5,
  approved_manual_hours: 12,
  pending_logs: 2,
  total_hours: 57.5,
  progress_percent: 38.3,
};

// ─── Helpers ───
function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function makeSession(uid, email, token, fullName, role) {
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `e2e-refresh-${role}`,
    user: {
      id: uid,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: fullName, role },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

// ─── Route setup ───
async function mockSupabase(page) {
  // Match any request to a supabase.co domain
  const SB = '**/supabase.co/**';

  // ── Auth: sign in (POST /auth/v1/token?grant_type=password) ──
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    let body;
    try { body = route.request().postDataJSON(); } catch { body = {}; }

    if (body.email === STUDENT_EMAIL && body.password === STUDENT_PW) {
      return json(route, 200,
        makeSession(STUDENT_UID, STUDENT_EMAIL, STUDENT_TOKEN, 'ישראל ישראלי', 'student'));
    }
    if (body.email === ADMIN_EMAIL && body.password === ADMIN_PW) {
      return json(route, 200,
        makeSession(ADMIN_UID, ADMIN_EMAIL, ADMIN_TOKEN, 'מנהל מערכת', 'admin'));
    }
    // Wrong credentials
    return json(route, 400, {
      error: 'invalid_grant',
      error_description: 'Invalid login credentials',
    });
  });

  // ── Auth: refresh token (POST /auth/v1/token?grant_type=refresh_token) ──
  await page.route('**/auth/v1/token?grant_type=refresh_token', async (route) => {
    let body;
    try { body = route.request().postDataJSON(); } catch { body = {}; }

    if (body.refresh_token === 'e2e-refresh-student') {
      return json(route, 200,
        makeSession(STUDENT_UID, STUDENT_EMAIL, STUDENT_TOKEN, 'ישראל ישראלי', 'student'));
    }
    if (body.refresh_token === 'e2e-refresh-admin') {
      return json(route, 200,
        makeSession(ADMIN_UID, ADMIN_EMAIL, ADMIN_TOKEN, 'מנהל מערכת', 'admin'));
    }
    return json(route, 401, { error: 'invalid_grant', error_description: 'Invalid refresh token' });
  });

  // ── Auth: get user (GET /auth/v1/user) ──
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();

    const auth = route.request().headers()['authorization'] || '';
    if (auth.includes(STUDENT_TOKEN)) {
      return json(route, 200, makeSession(STUDENT_UID, STUDENT_EMAIL, STUDENT_TOKEN, 'ישראל ישראלי', 'student').user);
    }
    if (auth.includes(ADMIN_TOKEN)) {
      return json(route, 200, makeSession(ADMIN_UID, ADMIN_EMAIL, ADMIN_TOKEN, 'מנהל מערכת', 'admin').user);
    }
    return json(route, 401, { message: 'not authenticated' });
  });

  // ── Auth: sign out (POST /auth/v1/logout) ──
  await page.route('**/auth/v1/logout', async (route) => {
    return route.fulfill({ status: 204, body: '' });
  });

  // ── Auth: sign up (POST /auth/v1/signup) ──
  await page.route('**/auth/v1/signup', async (route) => {
    let body;
    try { body = route.request().postDataJSON(); } catch { body = {}; }

    return json(route, 200, {
      id: 'e2e-new-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: body.email,
      user_metadata: body.data || {},
      created_at: new Date().toISOString(),
    });
  });

  // ── REST: profiles ──
  await page.route('**/rest/v1/profiles**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method !== 'GET') {
      return json(route, 200, []);
    }

    if (url.includes(STUDENT_UID)) {
      return json(route, 200, [STUDENT_PROFILE]);
    }
    if (url.includes(ADMIN_UID)) {
      return json(route, 200, [ADMIN_PROFILE]);
    }
    // Return all profiles (for admin panel student list)
    return json(route, 200, [STUDENT_PROFILE]);
  });

  // ── REST: shifts ──
  await page.route('**/rest/v1/shifts**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      // Active shift check
      if (url.includes('status=eq.active')) {
        return json(route, 200, []);
      }
      return json(route, 200, [SAMPLE_SHIFT]);
    }
    if (method === 'POST') {
      return json(route, 201, [{
        ...SAMPLE_SHIFT,
        id: 'shift-new',
        start_time: new Date().toISOString(),
        end_time: null,
        status: 'active',
        duration_minutes: null,
      }]);
    }
    if (method === 'PATCH') {
      return json(route, 200, [{
        ...SAMPLE_SHIFT,
        end_time: new Date().toISOString(),
        status: 'completed',
      }]);
    }
    return json(route, 200, []);
  });

  // ── REST: manual_logs ──
  await page.route('**/rest/v1/manual_logs**', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      return json(route, 200, [SAMPLE_MANUAL_LOG]);
    }
    if (method === 'POST') {
      return json(route, 201, [{
        ...SAMPLE_MANUAL_LOG,
        id: 'log-new',
        created_at: new Date().toISOString(),
      }]);
    }
    if (method === 'PATCH') {
      return json(route, 200, [{ ...SAMPLE_MANUAL_LOG, status: 'approved' }]);
    }
    return json(route, 200, []);
  });

  // ── REST: RPC endpoints ──
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const url = route.request().url();

    if (url.includes('get_all_students_summary')) {
      return json(route, 200, [STUDENT_SUMMARY]);
    }
    return json(route, 200, []);
  });

  // ── Catch-all for any other supabase.co requests ──
  await page.route(SB, async (route) => {
    const url = route.request().url();
    // Let already-handled routes fall through; catch anything else
    if (url.includes('/auth/v1/') || url.includes('/rest/v1/')) {
      return route.fallback();
    }
    // Realtime, storage, etc. — return empty OK
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

// ─── Extended test fixture ───
const test = base.extend({
  page: async ({ page }, use) => {
    await mockSupabase(page);
    await use(page);
  },
});

export { test, expect };
