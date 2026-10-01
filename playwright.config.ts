import { defineConfig, devices } from '@playwright/test';

/**
 * Pilot verification for the Concept 2294 learning journey.
 *
 * No `webServer` entry on purpose: this pilot is checked against the dev
 * stack already running (Next.js on :3000, Laravel on :8000) rather than
 * spinning up a second instance — see the pilot's own report for how those
 * were started. Point PW_BASE_URL elsewhere if that stack ever moves.
 */
export default defineConfig({
  testDir: './tests',
  // `php artisan serve` (the backend under test) is PHP's single-threaded
  // built-in dev server — every request from the dashboard shell (menu
  // rights, notifications, this page's own data) queues behind the last, so
  // a real page load against it is far slower than against a real app
  // server. Generous on purpose; this is a dev-stack constraint, not
  // something the pilot's own code controls.
  timeout: 240_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
