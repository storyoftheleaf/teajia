import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const handoffPath = process.env.TEA_REFERENCE_HANDOFF_PATH;
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(localChrome) ? localChrome : undefined);

if (!handoffPath) {
  throw new Error(
    'TEA_REFERENCE_HANDOFF_PATH is required. Point it to an absolute, private website-handoff.json path.',
  );
}

export default defineConfig({
  testDir: './tests',
  testMatch: 'tea-reference-preview.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/tea-reference-preview',
  use: {
    baseURL: 'http://localhost:7777',
    launchOptions: executablePath ? { executablePath } : undefined,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run tea-reference:teajia:preview -- --handoff "$TEA_REFERENCE_HANDOFF_PATH"',
    url: 'http://localhost:7777',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
