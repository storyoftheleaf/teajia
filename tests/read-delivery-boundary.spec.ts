import { test, expect, chromium, type Browser } from './fixtures';

test.setTimeout(45_000);
import { createServer, type Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
let worker: { fetch: (request: Request, env: any) => Promise<Response> };
import { pathToFileURL } from 'node:url';
import type { SqliteD1 } from '../worker/tests/helpers/sqliteD1';
import { serveReadAsset, type ReadAsset } from '../functions/readAssetDelivery';

let server: Server;
let browser: Browser;
let origin: string;
let db: SqliteD1;
let ownerToken: string;
let protectedAssets: Record<string, ReadAsset>;
const SECRET = 'synthetic-browser-read-secret';
const root = path.resolve('dist');
const csp = fs.readFileSync('public/_headers', 'utf8').split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'))!.trim().slice('Content-Security-Policy:'.length).trim();
const contentTypes: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

test.beforeAll(async () => {
  // Uses the candidate's real production artifact and Pages delivery function,
  // with a seeded in-memory Worker database. No production connection exists.
  // Bundle the real Worker for this Node harness, including its JSON imports.
  // Playwright's native TS loader cannot link the shared word-library JSON.
  const compiled = await build({
    stdin: { contents: "export { default as worker } from './worker/src/index.ts'; export { SqliteD1, seedIdentity, signedToken } from './worker/tests/helpers/sqliteD1.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(path.resolve('worker/tests/helpers/sqliteD1.ts')).href) },
  });
  const runtime = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  worker = runtime.worker;
  protectedAssets = JSON.parse(fs.readFileSync('functions/readAssets.generated.json', 'utf8'));
  db = new runtime.SqliteD1();
  runtime.seedIdentity(db, { userId: 'editor', accountId: 'acc_teajia_bali' });
  db.sqlite.prepare("UPDATE accounts SET kind = 'platform', is_platform_owner = 1 WHERE id = 'acc_teajia_bali'").run();
  ownerToken = await runtime.signedToken(SECRET, { sub: 'editor', email: 'editor@test.dev', active_account_id: 'acc_teajia_bali' });
  const workerFetch: typeof fetch = async (input, init) => worker.fetch(new Request(input, init), { DB: db, JWT_SECRET: SECRET, APP_URL: 'https://site.test' } as any);
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, origin);
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(Buffer.from(chunk));
      const request = new Request(url, { method: req.method, headers: req.headers as HeadersInit,
        ...(buffers.length ? { body: Buffer.concat(buffers) } : {}) });
      let response: Response;
      if (url.pathname.startsWith('/read-assets/')) {
        response = await serveReadAsset(request, 'https://worker.test', protectedAssets[url.pathname], workerFetch);
      } else if (url.pathname.startsWith('/api/')) {
        response = await workerFetch(new URL(url.pathname + url.search, 'https://worker.test'), request);
      } else {
        const file = path.resolve(root, '.' + url.pathname);
        if (!file.startsWith(root + '/')) { res.writeHead(404).end(); return; }
        const exists = fs.existsSync(file) && fs.statSync(file).isFile();
        if (!exists && path.extname(file)) { res.writeHead(404).end(); return; }
        response = new Response(fs.readFileSync(exists ? file : path.join(root, 'index.html')), {
          headers: { 'Content-Type': contentTypes[path.extname(exists ? file : 'index.html')] || 'application/octet-stream' },
        });
      }
      response.headers.set('Content-Security-Policy', csp);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  browser = await chromium.launch({ headless: true });
});

test.afterAll(async () => { await browser?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); db?.close(); });

async function open(token?: string) {
  const context = await browser.newContext();
  // Never contact a deployed API or metered media even if a developer built
  // with production environment variables. A mismatched build must fail here.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  if (token) await context.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  const page = await context.newPage();
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.startsWith('/api/read/') || pathname.startsWith('/api/public/read/') || pathname.startsWith('/api/story-content/')) {
      return new URL(route.request().url()).origin === origin ? route.continue() : route.abort();
    }
    if (pathname === '/api/auth/me') return route.fulfill({ json: { user: { id: 'editor', role: 'user', name: 'Synthetic Editor' }, memberships: [] } });
    return route.fulfill({ json: [] });
  });
  return { context, page };
}

test.describe('production Read delivery', () => {
  test('keeps direct private assets and maps confidential for anonymous and forged browser sessions', async () => {
    const modulePath = Object.keys(protectedAssets).find(key => protectedAssets[key].paths.includes('/read/history'))!;
    const response = await fetch(origin + modulePath);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect((await fetch(origin + modulePath + '.map')).status).toBe(404);
    expect((await fetch(origin + modulePath.replace('/read-assets/', '/assets/'))).status).toBe(404);
    const forged = `header.${Buffer.from(JSON.stringify({ sub: 'editor', platform_role: 'platform_owner', exp: 9999999999 })).toString('base64url')}.forged`;
    for (const token of [undefined, forged]) {
      const { context, page } = await open(token);
      await page.goto(origin + '/read/history');
      await expect.poll(() => page.title()).toBe('Not found · Teajia');
      expect((await context.request.get(origin + modulePath)).status()).toBe(404);
      await context.close();
    }
  });

  test('renders live templates and lets a real editor preview a draft without a static draft asset', async ({}, testInfo) => {
    for (const [href, token] of [['/read/ritual', undefined], ['/read/porcelain-and-tea', undefined], ['/read/history', ownerToken]] as const) {
      const { context, page } = await open(token);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + href);
      await expect.poll(() => page.title()).not.toBe('Teajia');
      await expect.poll(() => page.locator('h1').count()).toBeGreaterThan(0);
      expect(await page.title()).not.toContain('Not found');
      expect(errors).toEqual([]);
      if (href === '/read/porcelain-and-tea') await page.screenshot({ path: testInfo.outputPath('teajia-read-public-template.png'), fullPage: false });
      if (token) {
        const cookie = (await context.cookies()).find(cookie => cookie.name === '__Host-teajia-read');
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.secure).toBe(true);
        const modulePath = Object.keys(protectedAssets).find(key => protectedAssets[key].paths.includes(href))!;
        expect(await page.evaluate(async url => (await fetch(url)).status, origin + modulePath)).toBe(200);
        db.sqlite.prepare("UPDATE accounts SET kind = 'master', is_platform_owner = 0 WHERE id = 'acc_teajia_bali'").run();
        expect(await page.evaluate(async url => (await fetch(url)).status, origin + modulePath)).toBe(404);
      }
      await context.close();
    }
  });
});
