/**
 * Shared E2E test utilities for Kazzaz Hours Log
 *
 * Usage:
 *   import { login, logout, STUDENT, ADMIN } from './helpers';
 */

// ─── Test Credentials (from environment or defaults) ───
export const STUDENT = {
  email: process.env.TEST_USER_EMAIL || 'student@test.com',
  password: process.env.TEST_USER_PASSWORD || 'test123456',
};

export const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'admin123456',
};

/**
 * Log in as a given user.
 * Waits for the auth form, fills credentials, submits, and waits for
 * the dashboard/admin panel to appear.
 */
export async function login(page, { email, password } = STUDENT) {
  await page.goto('/');

  // Wait for auth form to render
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });

  // Fill credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click submit
  await page.click('button[type="submit"]');

  // Wait for loading to finish — either dashboard or admin panel appears
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      // Dashboard indicators
      const hasDashboard = body.includes('דיווחי שעות מלגאים') && body.includes('שלום,');
      // Admin panel indicator
      const hasAdmin = body.includes('לוח בקרה · מנהל');
      // Error indicator
      const hasError = body.includes('שגיאה');
      return hasDashboard || hasAdmin || hasError;
    },
    { timeout: 15_000 }
  );
}

/**
 * Log out from any screen.
 * Clicks the logout button (identified by title="יציאה") and waits
 * for the auth form to reappear.
 */
export async function logout(page) {
  // The logout button has title="יציאה" or aria-label="יציאה מהמערכת"
  const logoutBtn = page.locator('[title="יציאה"], [aria-label="יציאה מהמערכת"]').first();
  await logoutBtn.click();

  // Wait for auth screen to appear
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
}

/**
 * Wait for app to be fully loaded (no spinners, no skeletons).
 */
export async function waitForAppReady(page) {
  // Wait until there are no skeleton loaders or spinning loaders
  await page.waitForFunction(
    () => {
      const skeletons = document.querySelectorAll('.skeleton');
      const spinners = document.querySelectorAll('.animate-spin');
      return skeletons.length === 0 && spinners.length === 0;
    },
    { timeout: 15_000 }
  );
}

/**
 * Check that an element is fully visible and not overlapped by other elements.
 * Returns { visible, overlapped, details }
 */
export async function checkElementVisibility(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { visible: false, overlapped: false, details: 'Element not found' };

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { visible: false, overlapped: false, details: 'Element has zero size' };
    }

    // Check if element is in viewport
    const inViewport =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth;

    // Check center point for overlap
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    const overlapped = topEl !== el && !el.contains(topEl);

    return {
      visible: true,
      inViewport,
      overlapped,
      details: overlapped
        ? `Overlapped by: <${topEl?.tagName?.toLowerCase()}> .${topEl?.className?.split(' ')[0]}`
        : 'OK',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    };
  }, selector);
}
