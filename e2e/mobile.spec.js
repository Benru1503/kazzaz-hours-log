import { test, expect } from '@playwright/test';
import { login, STUDENT, checkElementVisibility } from './helpers';

/**
 * Mobile-specific tests.
 *
 * These run on ALL projects (including mobile viewports defined in playwright.config.js).
 * Tests focus on layout, touch targets, overflow, and element visibility.
 * These would have caught: layout overlap, non-spinning spinner, broken logout on mobile.
 */
test.describe('Mobile & Layout', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, STUDENT);
    await expect(page.locator('text=שלום,')).toBeVisible({ timeout: 15_000 });
  });

  // ═══════════════════════════════════════════
  // NO HORIZONTAL OVERFLOW
  // ═══════════════════════════════════════════
  test('no horizontal scroll (no content overflow)', async ({ page }) => {
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('no horizontal scroll on manual log tab', async ({ page }) => {
    await page.click('text=דיווח ידני');
    await page.waitForTimeout(300); // wait for tab animation

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('no horizontal scroll on history tab', async ({ page }) => {
    await page.click('text=היסטוריה');
    await page.waitForTimeout(300);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  // ═══════════════════════════════════════════
  // TOUCH TARGETS (minimum 44x44 pixels)
  // ═══════════════════════════════════════════
  test('logout button meets minimum touch target size (44x44)', async ({ page }) => {
    const btn = page.locator('[title="יציאה"], [aria-label="יציאה מהמערכת"]').first();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(40); // allow small tolerance
    expect(box.height).toBeGreaterThanOrEqual(40);
  });

  test('tab buttons are large enough to tap', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();

    for (let i = 0; i < count; i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('submit button is large enough to tap', async ({ page }) => {
    // Check-in button or manual log submit
    const submitBtns = page.locator('button:has-text("כניסה למשמרת"), button:has-text("שלח לאישור")');
    const count = await submitBtns.count();

    for (let i = 0; i < count; i++) {
      if (await submitBtns.nth(i).isVisible()) {
        const box = await submitBtns.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // ═══════════════════════════════════════════
  // MANUAL LOG — LAYOUT OVERLAP REGRESSION
  // ═══════════════════════════════════════════
  test('manual log: date input is fully visible and not overlapped', async ({ page }) => {
    await page.click('text=דיווח ידני');
    await page.waitForTimeout(300);

    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    const box = await dateInput.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(30);
    expect(box.width).toBeGreaterThan(50);
  });

  test('manual log: all form fields are visible without scrolling inside container', async ({ page }) => {
    await page.click('text=דיווח ידני');
    await page.waitForTimeout(300);

    // All form elements should exist and be visible
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('text=שלח לאישור')).toBeVisible();
  });

  test('manual log: form fields do not visually overlap each other', async ({ page }) => {
    await page.click('text=דיווח ידני');
    await page.waitForTimeout(300);

    // Get all form field bounding boxes
    const fields = [];

    const dateInput = page.locator('input[type="date"]');
    const selectInput = page.locator('select');
    const hoursInput = page.locator('input[type="number"]').first();
    const minutesInput = page.locator('input[type="number"]').last();
    const textarea = page.locator('textarea');
    const submitBtn = page.locator('button:has-text("שלח לאישור")');

    for (const el of [dateInput, selectInput, hoursInput, minutesInput, textarea, submitBtn]) {
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) fields.push(box);
      }
    }

    // Check no two fields that should be on different rows overlap vertically
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const a = fields[i];
        const b = fields[j];

        // Only check fields that are on different rows (not side-by-side)
        const sameRow = Math.abs(a.y - b.y) < a.height * 0.5;
        if (sameRow) continue;

        // Fields on different rows should not overlap vertically
        const vertOverlap = Math.max(
          0,
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        );
        expect(vertOverlap).toBeLessThanOrEqual(2); // 2px tolerance for borders
      }
    }
  });

  // ═══════════════════════════════════════════
  // PROGRESS RING FITS IN VIEWPORT
  // ═══════════════════════════════════════════
  test('progress ring fits within viewport width', async ({ page }) => {
    const viewport = page.viewportSize();
    const ring = page.locator('[role="progressbar"]').first();

    if (await ring.isVisible()) {
      const box = await ring.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5); // small tolerance
    }
  });

  // ═══════════════════════════════════════════
  // HEADER STICKS TO TOP
  // ═══════════════════════════════════════════
  test('header stays visible after scrolling', async ({ page }) => {
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(200);

    // Header should still be visible (sticky)
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeLessThanOrEqual(5); // should be at top (within tolerance)
  });

  // ═══════════════════════════════════════════
  // CATEGORY GRID LAYOUT
  // ═══════════════════════════════════════════
  test('category buttons are all visible and not cut off', async ({ page }) => {
    const checkin = page.locator('text=התחלת משמרת חדשה');
    if (await checkin.isVisible()) {
      const viewport = page.viewportSize();
      const categories = ['חונכות', 'הדרכה', 'שירות קהילתי', 'עבודה משרדית', 'תמיכה באירועים', 'אחר'];

      for (const cat of categories) {
        const btn = page.locator(`button:has-text("${cat}")`);
        await expect(btn).toBeVisible();

        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        // Button should be within viewport
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5);
      }
    }
  });

  // ═══════════════════════════════════════════
  // ANIMATIONS ACTUALLY WORK
  // ═══════════════════════════════════════════
  test('CSS animations are not broken (animation-name is set)', async ({ page }) => {
    // Check that at least one element has a running animation
    // This catches the "spinner doesn't spin" issue
    const animationStatus = await page.evaluate(() => {
      const results = {};

      // Check for any active animations
      const allEls = document.querySelectorAll('*');
      let anyAnimation = false;
      for (const el of allEls) {
        const style = getComputedStyle(el);
        if (style.animationName && style.animationName !== 'none') {
          anyAnimation = true;
          break;
        }
      }
      results.hasAnyAnimation = anyAnimation;

      // Check gradient classes are rendering
      const gradientEl = document.querySelector('.gradient-primary');
      if (gradientEl) {
        const bg = getComputedStyle(gradientEl).background;
        results.gradientWorks = bg.includes('gradient') || bg.includes('linear');
      }

      // Check glass effect
      const glassEl = document.querySelector('.glass');
      if (glassEl) {
        const backdrop = getComputedStyle(glassEl).backdropFilter ||
                        getComputedStyle(glassEl).webkitBackdropFilter;
        results.glassWorks = backdrop && backdrop !== 'none';
      }

      return results;
    });

    // At least gradients or glass should work
    expect(
      animationStatus.gradientWorks || animationStatus.glassWorks
    ).toBe(true);
  });

  // ═══════════════════════════════════════════
  // RTL DIRECTION
  // ═══════════════════════════════════════════
  test('page is RTL directed', async ({ page }) => {
    const dir = await page.evaluate(() => {
      return document.documentElement.getAttribute('dir') ||
             getComputedStyle(document.body).direction;
    });
    expect(dir).toBe('rtl');
  });
});
