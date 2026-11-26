import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// npx playwright test --config tests/home-and-bar.config.ts
//
// Two local sites from this checkout: 7898 with the new bar off (HOME_BAR_OPEN
// as shipped) and 7899 with it on, so both states are walked at each size.
// Every API answer is mocked in the spec; nothing reaches the live API.
const OFF = Number(process.env.HOME_BAR_OFF_PORT ?? 7898);
const ON = Number(process.env.HOME_BAR_ON_PORT ?? 7899);
const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = process.env.PW_CHROMIUM ?? undefined;

const server = (port: number, open: boolean) => ({
  cwd: root,
  command: `node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port ${port} --strictPort`,
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: false,
  timeout: 120_000,
  env: { VITE_API_URL: `http://127.0.0.1:${port}`, VITE_HOME_BAR_OPEN: open ? 'true' : 'false' },
});

const sizes = [
  { name: '320', viewport: { width: 320, height: 700 }, phone: true },
  { name: '390', viewport: { width: 390, height: 844 }, phone: true },
  { name: '1280', viewport: { width: 1280, height: 800 }, phone: false },
];

export default defineConfig({
  testDir: '.',
  testMatch: 'home-and-bar.spec.ts',
  metadata: { homeAndBar: true },
  timeout: 180_000,
  reporter: 'list',
  workers: 1,
  webServer: [server(OFF, false), server(ON, true)],
  use: {
    trace: 'off',
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: (['off', 'on'] as const).flatMap(bar => sizes.map(size => ({
    name: `bar-${bar}-${size.name}`,
    metadata: { bar },
    use: {
      ...(size.phone ? devices['Pixel 5'] : devices['Desktop Chrome']),
      viewport: size.viewport,
      baseURL: `http://127.0.0.1:${bar === 'on' ? ON : OFF}`,
    },
  }))),
});
