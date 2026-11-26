import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// A dedicated server keeps these build-time switches out of the closed-flag suites.
const port = Number(process.env.K12_PORT ?? 17432);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 7777) {
  throw new Error('K12_PORT must be an unused port from 1024 to 65535 other than 7777.');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'launch-4-journey.spec.ts',
  metadata: { launch4Journey: true },
  timeout: 90_000,
  reporter: 'list',
  workers: 2,
  webServer: {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    command: `node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_API_URL: baseURL,
      VITE_TEA_TABLE_OPEN: 'true',
      VITE_FAVOURITES_OPEN: 'true',
      VITE_YOUR_TABLE_PAGE_OPEN: 'true',
      VITE_TEA_HOUSES_OPEN: 'true',
    },
  },
  use: { baseURL, serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
