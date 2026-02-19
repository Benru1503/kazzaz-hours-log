import { test, expect } from '@playwright/test';
import { login, logout, ADMIN } from './helpers';

test.describe('Admin Panel', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.locator('text=לוח בקרה · מנהל')).toBeVisible({ timeout: 15_000 });
  });

  // ═══════════════════════════════════════════
  // HEADER & LAYOUT
  // ═══════════════════════════════════════════
  test('admin header shows correctly', async ({ page }) => {
    await expect(page.locator('text=לוח בקרה · מנהל')).toBeVisible();
  });

  test('stats cards are visible', async ({ page }) => {
    await expect(page.getByText('סטודנטים', { exact: true }).first()).toBeVisible();
    await expect(page.locator('text=ממוצע התקדמות')).toBeVisible();
    await expect(page.locator('text=השלימו יעד')).toBeVisible();
    await expect(page.locator('text=ממתינים לאישור')).toBeVisible();
  });

  // ═══════════════════════════════════════════
  // TABS
  // ═══════════════════════════════════════════
  test('both tabs are visible', async ({ page }) => {
    await expect(page.locator('text=סקירת סטודנטים')).toBeVisible();
    await expect(page.locator('text=אישור דיווחים')).toBeVisible();
  });

  test('student overview tab shows by default', async ({ page }) => {
    // Should show either student list or empty state
    const hasStudents = page.locator('text=שעות משמרת').first();
    const empty = page.locator('text=אין סטודנטים רשומים עדיין');
    await expect(hasStudents.or(empty)).toBeVisible({ timeout: 10_000 });
  });

  test('pending approvals tab switches correctly', async ({ page }) => {
    await page.click('text=אישור דיווחים');

    // Should show either pending logs or empty state
    const hasPending = page.locator('text=אשר');
    const empty = page.locator('text=אין דיווחים ממתינים');
    await expect(hasPending.or(empty)).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════
  // STUDENT DETAIL VIEW
  // ═══════════════════════════════════════════
  test('clicking a student shows detail view (if students exist)', async ({ page }) => {
    // Check if there are any student cards (clickable divs with progress bars)
    const studentCards = page.locator('.glass.cursor-pointer, [role="button"]');
    const count = await studentCards.count();

    if (count > 0) {
      await studentCards.first().click();

      // Should show back button
      await expect(page.locator('text=חזרה לרשימה')).toBeVisible({ timeout: 5_000 });

      // Go back
      await page.click('text=חזרה לרשימה');
      await expect(page.locator('text=חזרה לרשימה')).toBeHidden();
    }
  });

  // ═══════════════════════════════════════════
  // REFRESH BUTTON
  // ═══════════════════════════════════════════
  test('refresh button exists and is clickable', async ({ page }) => {
    const refreshBtn = page.locator('[title="רענון נתונים"], [aria-label="רענון נתונים"]').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    // Should not crash — just refresh data
    await page.waitForTimeout(1000);
    await expect(page.locator('text=לוח בקרה · מנהל')).toBeVisible();
  });

  // ═══════════════════════════════════════════
  // PENDING APPROVALS — APPROVE/REJECT BUTTONS
  // ═══════════════════════════════════════════
  test('approve and reject buttons are visible on pending logs', async ({ page }) => {
    await page.click('text=אישור דיווחים');

    const approveBtn = page.locator('button:has-text("אשר")');
    const rejectBtn = page.locator('button:has-text("דחה")');

    // If there are pending logs, both buttons should be visible
    if (await approveBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(approveBtn.first()).toBeVisible();
      await expect(rejectBtn.first()).toBeVisible();

      // Both should be clickable (not disabled, not overlapped)
      const approveBox = await approveBtn.first().boundingBox();
      const rejectBox = await rejectBtn.first().boundingBox();
      expect(approveBox).not.toBeNull();
      expect(rejectBox).not.toBeNull();
      expect(approveBox.width).toBeGreaterThan(30);
      expect(rejectBox.width).toBeGreaterThan(30);
    }
  });

  // ═══════════════════════════════════════════
  // ADMIN LOGOUT
  // ═══════════════════════════════════════════
  test('admin can logout', async ({ page }) => {
    await logout(page);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════
  // MOBILE LAYOUT
  // ═══════════════════════════════════════════
  test('no horizontal overflow in admin panel', async ({ page }) => {
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});
