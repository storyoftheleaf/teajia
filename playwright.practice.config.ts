import { defineConfig, devices } from '@playwright/test';

/**
 * Browser specs that run against the practice shop on THIS checkout.
 *
 * Starts both servers itself and stops them when the run ends:
 *   API   http://127.0.0.1:8798  (npm --prefix worker run practice, local database, no live calls)
 *   site  http://127.0.0.1:7813  (npm run practice:site, proxied to that API)
 * Ports 7777 and 8787 belong to other sessions and are never used here.
 *
 * Run: npx playwright test --config playwright.practice.config.ts tests/<spec>
 * Specs import `test` and `expect` from tests/fixtures.ts.
 *
 * Several sessions share this machine. When 8798 or 7813 is already held by
 * another checkout, set PRACTICE_API_PORT and PRACTICE_SITE_PORT to free ones;
 * the two npm scripts read the same names.
 */
const API_PORT = process.env.PRACTICE_API_PORT || '8798';
const SITE_PORT = process.env.PRACTICE_SITE_PORT || '7813';

export default defineConfig({
  testDir: './tests',
  // The practice specs, plus the full walk of the family plan (tests/teajia-family-walk.spec.ts).
  testMatch: /(practice-.*|teajia-family-walk)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/practice',
  use: {
    baseURL: `http://127.0.0.1:${SITE_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'npm --prefix worker run practice',
      url: `http://127.0.0.1:${API_PORT}/api/people`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run practice:site',
      url: `http://127.0.0.1:${SITE_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
