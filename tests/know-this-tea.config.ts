import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// "Does anyone know this tea?" (Launch 5, M8), open. A dedicated server keeps
// these build-time switches out of the closed-flag suites, where the same
// spec proves nothing shows.
//
//   npx playwright test -c tests/know-this-tea.config.ts
//   KNOW_THIS_TEA_CLOSED=1 npx playwright test -c tests/know-this-tea.config.ts   (the closed walk)
//
// PLAYWRIGHT_CHROMIUM_PATH points at a local Chromium when the bundled one is missing.
const port = Number(process.env.KNOW_THIS_TEA_PORT ?? 7901);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 7777) {
  throw new Error('KNOW_THIS_TEA_PORT must be an unused port from 1024 to 65535 other than 7777.');
}
const baseURL = `http://127.0.0.1:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const closed = process.env.KNOW_THIS_TEA_CLOSED === '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'know-this-tea.spec.ts',
  metadata: { knowThisTeaOpen: !closed },
  timeout: 90_000,
  reporter: 'list',
  workers: 2,
  webServer: {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    command: `node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_URL: baseURL,
      VITE_TEA_TABLE_OPEN: 'true',
      VITE_KNOW_THIS_TEA_OPEN: closed ? 'false' : 'true',
    },
  },
  use: {
    baseURL, serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' },
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
