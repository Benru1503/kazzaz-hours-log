import { test, expect } from './fixtures';
import { login, logout, waitForAppReady, STUDENT } from './helpers';

test.describe('Dashboard — Student Experience', () => {

  // Login before each test
  test.beforeEach(async ({ page }) => {
    await login(page, STUDENT);
    await expect(page.locator('text=שלום,')).toBeVisible({ timeout: 15_000 });
  });

  // ═══════════════════════════════════════════
  // HEADER & LAYOUT
  // ═══════════════════════════════════════════
  test('header shows app name and user name', async ({ page }) => {
    await expect(page.locator('text=דיווחי שעות מלגאים')).toBeVisible();
    await expect(page.locator('text=שלום,')).toBeVisible();
  });

  test('progress ring is visible', async ({ page }) => {
    // Progress ring shows a percentage
    await expect(page.locator('text=/%/')).toBeVisible({ timeout: 10_000 });
  });

  test('stats grid shows 4 stat cards', async ({ page }) => {
    await expect(page.locator('text=שעות משמרת')).toBeVisible();
    await expect(page.locator('text=שעות ידניות')).toBeVisible();
    await expect(page.locator('text=סה"כ שעות')).toBeVisible();
    await expect(page.locator('text=ממתינים')).toBeVisible();
  });

  // ═══════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════
  test('loading state has animation (spinner or skeleton)', async ({ page }) => {
    // Navigate fresh — catch the loading state
    await page.goto('/');
    // Check if any animation is present during load
    const hasAnimation = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const style = getComputedStyle(el);
        if (style.animationName && style.animationName !== 'none') {
          return true;
        }
      }
      return false;
    });
    // During loading, there should be SOME animation (spinner, skeleton, etc.)
    // This catches the "spinner doesn't spin" bug
    expect(hasAnimation).toBe(true);
  });

  // ═══════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════
  test('three tabs are visible: clock, history, manual', async ({ page }) => {
    await expect(page.locator('text=שעון נוכחות').last()).toBeVisible();
    await expect(page.locator('text=היסטוריה')).toBeVisible();
    await expect(page.locator('text=דיווח ידני')).toBeVisible();
  });

  test('punch clock tab is default', async ({ page }) => {
    // Should show either "התחלת משמרת חדשה" (no active shift) or "משמרת פעילה" (active)
    const checkin = page.locator('text=התחלת משמרת חדשה');
    const active = page.locator('text=משמרת פעילה');
    await expect(checkin.or(active)).toBeVisible({ timeout: 10_000 });
  });

  test('clicking history tab shows history content', async ({ page }) => {
    await page.click('text=היסטוריה');
    await expect(page.locator('text=משמרות אחרונות')).toBeVisible();
  });

  test('clicking manual tab shows manual log form', async ({ page }) => {
    await page.click('text=דיווח ידני');
    await expect(page.locator('text=דיווח שעות ידני')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('tabs switch content correctly (no stale content)', async ({ page }) => {
    // Go to history
    await page.click('text=היסטוריה');
    await expect(page.locator('text=משמרות אחרונות')).toBeVisible();

    // Go to manual
    await page.click('text=דיווח ידני');
    await expect(page.locator('text=דיווח שעות ידני')).toBeVisible();
    // History content should be gone
    await expect(page.locator('text=משמרות אחרונות')).toBeHidden();

    // Go back to clock
    const clockTab = page.locator('[role="tab"]:has-text("שעון נוכחות")');
    await clockTab.click();
    const checkin = page.locator('text=התחלת משמרת חדשה');
    const active = page.locator('text=משמרת פעילה');
    await expect(checkin.or(active)).toBeVisible();
  });

  // ═══════════════════════════════════════════
  // PUNCH CLOCK — CHECK IN
  // ═══════════════════════════════════════════
  test('check-in form has category grid and description input', async ({ page }) => {
    // Only if no active shift
    const checkin = page.locator('text=התחלת משמרת חדשה');
    if (await checkin.isVisible()) {
      await expect(page.locator('text=חונכות')).toBeVisible();
      await expect(page.locator('text=הדרכה')).toBeVisible();
      await expect(page.locator('input[placeholder="תיאור המשימה..."]')).toBeVisible();
      await expect(page.locator('text=כניסה למשמרת')).toBeVisible();
    }
  });

  test('check-in shows error when description is empty', async ({ page }) => {
    const checkin = page.locator('text=כניסה למשמרת');
    if (await checkin.isVisible()) {
      await checkin.click();
      await expect(page.locator('text=נא להזין תיאור משימה')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('category buttons are clickable and show selected state', async ({ page }) => {
    const tutoring = page.locator('button:has-text("חונכות")');
    if (await tutoring.isVisible()) {
      await tutoring.click();
      // Should have selected styling (cyan border/bg)
      const classes = await tutoring.getAttribute('class');
      expect(classes).toContain('cyan');
    }
  });

  // ═══════════════════════════════════════════
  // MANUAL LOG FORM
  // ═══════════════════════════════════════════
  test('manual log form has all required fields', async ({ page }) => {
    await page.click('text=דיווח ידני');

    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('text=שלח לאישור')).toBeVisible();
  });

  test('manual log form validates zero duration', async ({ page }) => {
    await page.click('text=דיווח ידני');

    // Fill date
    await page.fill('input[type="date"]', '2026-02-15');
    // Fill description
    await page.fill('textarea', 'test description');
    // Leave hours/minutes at 0
    await page.click('text=שלח לאישור');

    await expect(page.locator('text=נא להזין משך זמן תקין')).toBeVisible({ timeout: 5_000 });
  });

  test('manual log date and category inputs are not overlapping', async ({ page }) => {
    await page.click('text=דיווח ידני');

    const dateInput = page.locator('input[type="date"]');
    const selectInput = page.locator('select');

    await expect(dateInput).toBeVisible();
    await expect(selectInput).toBeVisible();

    // Get bounding boxes
    const dateBox = await dateInput.boundingBox();
    const selectBox = await selectInput.boundingBox();

    expect(dateBox).not.toBeNull();
    expect(selectBox).not.toBeNull();

    // On mobile (stacked): date bottom should be above or equal to select top
    // On desktop (side by side): no vertical overlap
    const verticalOverlap = Math.max(
      0,
      Math.min(dateBox.y + dateBox.height, selectBox.y + selectBox.height) -
        Math.max(dateBox.y, selectBox.y)
    );

    // If they're side by side (same row), overlap is fine
    // If they're stacked, they should NOT overlap
    const sameRow = Math.abs(dateBox.y - selectBox.y) < 10;
    if (!sameRow) {
      // Stacked — the gap between them should be positive
      const gap = selectBox.y - (dateBox.y + dateBox.height);
      expect(gap).toBeGreaterThanOrEqual(0);
    }
  });

  // ═══════════════════════════════════════════
  // HISTORY TAB
  // ═══════════════════════════════════════════
  test('history tab shows shift and manual log sections', async ({ page }) => {
    await page.click('text=היסטוריה');
    await expect(page.locator('text=משמרות אחרונות')).toBeVisible();
    await expect(page.locator('text=דיווחים ידניים')).toBeVisible();
  });

  // ═══════════════════════════════════════════
  // LOGOUT FROM DASHBOARD
  // ═══════════════════════════════════════════
  test('logout from dashboard works', async ({ page }) => {
    await logout(page);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });
});
