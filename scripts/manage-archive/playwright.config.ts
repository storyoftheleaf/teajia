import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Own config: the archive is not part of the repo's test suite. It starts
// `npm run dev:test` (port 7777, API mocked by the specs) and takes pictures.
const root = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 900_000,
  globalTeardown: path.join(__dirname, 'finalize.ts'),
  use: {
    baseURL: 'http://localhost:7777',
    trace: 'off',
    actionTimeout: 8000,
    deviceScaleFactor: 2,
    // The container has no downloaded Playwright browser; point at a system Chromium.
    // Set PW_CHROMIUM to override, or unset it where `playwright install` has been run.
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
  },
  webServer: { command: 'npm run dev:test', cwd: root, url: 'http://localhost:7777', reuseExistingServer: true, timeout: 180_000 },
});
