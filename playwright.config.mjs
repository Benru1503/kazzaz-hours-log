import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Load .env.test into process.env
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envFile = readFileSync(join(__dirname, '.env.test'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch {
  // .env.test not found — fall back to defaults or existing env vars
}
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests once (helps with network flakiness) */
  retries: process.env.CI ? 2 : 1,

  /* Run tests in parallel */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: nice HTML report + terminal list */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record trace on first retry */
    trace: 'on-first-retry',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Test against multiple browsers + mobile viewports */
  projects: [
    // ─── Desktop Chrome ───
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'] },
    },

    // ─── Desktop Firefox ───
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // ─── iPhone 14 (Safari mobile) ───
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
    },

    // ─── iPhone SE (smallest common iPhone) ───
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'] },
    },

    // ─── Android (Pixel 7) ───
    {
      name: 'android',
      use: { ...devices['Pixel 7'] },
    },
  ],

  /* Auto-start dev server before tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
