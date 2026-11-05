import { afterEach, vi } from 'vitest';
import path from 'node:path';

// These component journeys own synthetic API fixtures. Unmatched traffic must
// fail rather than reaching a shop, provider, or a local API left running.
const blocked: string[] = [];
const ownedOrigins = new Set<string>();
vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
  blocked.push('Node fetch');
  throw new Error('Unexpected fetch in isolated admin behavior test');
});
afterEach(() => {
  const unexpected = blocked.splice(0);
  if (unexpected.length) throw new Error(`Unmocked behavior-test traffic: ${unexpected.join(', ')}`);
});

vi.mock('vite', async original => {
  const actual = await original<typeof import('vite')>();
  return {
    ...actual,
    createServer: async (options: import('vite').InlineConfig = {}) => {
      const server = await actual.createServer({
        ...options,
        // Test mode disables the application's optional API proxy.
        mode: 'test',
        cacheDir: path.join(process.cwd(), 'node_modules/.cache/admin-behavior'),
        server: { ...options.server, host: '127.0.0.1', port: 0, hmr: false },
      });
      // Vite treats port 0 as its default port. Bind the public HTTP server
      // directly so the OS actually assigns a private, ephemeral port.
      server.listen = async () => {
        await new Promise<void>((resolve, reject) => {
          server.httpServer!.once('error', reject);
          server.httpServer!.listen(0, '127.0.0.1', () => {
            const address = server.httpServer!.address();
            if (!address || typeof address === 'string') return reject(new Error('Missing behavior-test port'));
            ownedOrigins.add(`http://127.0.0.1:${address.port}`);
            resolve();
          });
        });
        return server;
      };
      return server;
    },
  };
});

vi.mock('playwright', async original => {
  const actual = await original<typeof import('playwright')>();
  const chromium = Object.create(actual.chromium) as typeof actual.chromium;
  chromium.launch = async options => {
    const browser = await actual.chromium.launch(options);
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage({ ...options, serviceWorkers: 'block' });
      // Later test-specific routes supply the existing synthetic fixtures.
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (!ownedOrigins.has(url.origin) || url.pathname.startsWith('/api/')) {
          blocked.push(`${url.origin}${url.pathname}`);
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      return page;
    };
    return browser;
  };
  return { ...actual, chromium };
});
