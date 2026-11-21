import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  // Three specs have their own configs because they need a dev server started
  // in a different mode: the Tea Reference preview endpoints only exist under
  // `--mode tea-reference-preview`. Picked up here as well, they asked the
  // ordinary server for an endpoint it does not serve, got the application
  // shell, and failed parsing HTML as JSON. They run under
  // `npm run test:tea-reference-browser` and
  // `npm run test:tea-reference-revision-browser`.
  //
  // The practice-shop specs and the family walk are left out for the same kind
  // of reason: they need the practice API and its local database, which only
  // `playwright.practice.config.ts` starts. Run here they got the application
  // shell where they asked for JSON, and found no database file. The pattern
  // is the one that config selects, so the two can never both claim a spec.
  testIgnore: ['tea-reference-preview.spec.ts', 'tea-reference-revision-workflow.spec.ts', /(practice-.*|teajia-family-walk)\.spec\.ts/],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:7777',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: externalBaseURL ? undefined : {
    // Browser tests must start from a clean checkout without Infisical. The
    // regular dev command still hydrates local secrets for real development.
    command: 'npm run dev:test',
    url: 'http://localhost:7777',
    reuseExistingServer: !process.env.CI,
  },
});
