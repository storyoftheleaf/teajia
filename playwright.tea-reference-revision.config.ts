import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(localChrome) ? localChrome : undefined);

export default defineConfig({
  testDir: './tests',
  testMatch: 'tea-reference-revision-workflow.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/tea-reference-revision',
  use: {
    baseURL: externalBaseURL ?? 'http://localhost:7777',
    launchOptions: executablePath ? { executablePath } : undefined,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev:test',
    url: 'http://localhost:7777',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
