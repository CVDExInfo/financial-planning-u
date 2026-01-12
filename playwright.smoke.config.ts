import { defineConfig, devices } from '@playwright/test';

const rawBase = process.env.FINZ_UI_BASE_URL || 'https://d7t9x3j66yd8k.cloudfront.net/finanzas/';
const baseURL = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig({
  testDir: './tests/e2e/smoke',
  timeout: 120 * 1000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    browserName: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
