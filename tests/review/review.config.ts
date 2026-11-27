/**
 * The review walks' own config (tests/review/README.md). The main config
 * ignores tests/review/, because these walks need the review rig running.
 *
 *   REVIEW_SITE=http://localhost:7910 npx playwright test -c tests/review/review.config.ts --trace off
 */
import { defineConfig } from '@playwright/test';

const baseURL = process.env.REVIEW_SITE ?? 'http://localhost:7910';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: '../../test-results/review/artifacts',
  fullyParallel: false,
  // The walks share one fixture shop and change it as they go.
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: '../../test-results/review/report.json' }]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'off',
    screenshot: 'only-on-failure',
    ...(process.env.REVIEW_CHROMIUM ? { launchOptions: { executablePath: process.env.REVIEW_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'phone-320', use: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
