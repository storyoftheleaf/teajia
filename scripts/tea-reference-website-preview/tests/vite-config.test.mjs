import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build, createServer as createViteServer, resolveConfig } from 'vite';
import { chromium } from '@playwright/test';
import react from '@vitejs/plugin-react';

import { canonicalJson, sha256 } from '../../tea-reference-capture/canonical.mjs';
import { REPO_ROOT } from '../load-preview.mjs';

function emptyHandoff() {
  const payload = { entities: [], claims: [], citations: [], heldBack: [] };
  return {
    manifest: {
      schemaVersion: 1,
      siteModel: 'tea-wisdom-v1',
      mode: 'preview-only',
      claimsSha256: 'claims-hash',
      sourceSnapshotSha256: 'sources-hash',
      entityCount: 0,
      claimCount: 0,
      citationCount: 0,
      readyToPublishCount: 0,
      heldBackCount: 0,
      payloadSha256: sha256(canonicalJson(payload)),
    },
    ...payload,
  };
}

async function installedChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Fall through to Playwright's managed Chromium when no system browser is installed.
    }
  }
  return undefined;
}

async function serveStaticSpa(directory) {
  const server = createHttpServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const requested = pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1);
    const file = path.join(directory, requested);
    try {
      const body = await fs.readFile(file);
      const contentType = file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html';
      response.writeHead(200, { 'content-type': contentType });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

async function filesBeneath(directory) {
  try {
    const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
    return entries.filter(entry => entry.isFile()).map(entry => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

test('real Vite config gates the public adapter and suppresses preview optimizer writes', { timeout: 15000 }, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-vite-config-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  const previewCache = path.join(temp, 'preview-cache');
  await fs.writeFile(handoffPath, JSON.stringify(emptyHandoff()));
  const priorHandoffPath = process.env.TEA_REFERENCE_HANDOFF_PATH;
  process.env.TEA_REFERENCE_HANDOFF_PATH = handoffPath;
  t.after(() => {
    if (priorHandoffPath === undefined) delete process.env.TEA_REFERENCE_HANDOFF_PATH;
    else process.env.TEA_REFERENCE_HANDOFF_PATH = priorHandoffPath;
  });

  const normalServer = await createViteServer({
    root: REPO_ROOT,
    configFile: path.join(REPO_ROOT, 'vite.config.ts'),
    mode: 'development',
    cacheDir: path.join(temp, 'normal-cache'),
    logLevel: 'silent',
    clearScreen: false,
  });
  t.after(() => normalServer.close());
  assert.equal(normalServer.config.plugins.some(plugin => plugin.name === 'tea-reference-teajia-preview'), false);
  assert.notEqual(normalServer.config.optimizeDeps.noDiscovery, true);
  await normalServer.close();

  const previewServer = await createViteServer({
    root: REPO_ROOT,
    configFile: path.join(REPO_ROOT, 'vite.config.ts'),
    mode: 'tea-reference-preview',
    cacheDir: previewCache,
    logLevel: 'silent',
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  t.after(() => previewServer.close());
  assert.equal(previewServer.config.plugins.some(plugin => plugin.name === 'tea-reference-teajia-preview'), true);
  assert.equal(previewServer.config.optimizeDeps.noDiscovery, true);
  assert.deepEqual(previewServer.config.optimizeDeps.include, []);

  await previewServer.listen();
  const address = previewServer.httpServer.address();
  assert.equal(typeof address, 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/__tea-reference-preview`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(await response.json()), ['manifest', 'publicPreview']);
  await previewServer.close();

  assert.deepEqual(await filesBeneath(previewCache), []);
});

test('normal production builds reject Tea Reference preview modules while preview builds allow them', async () => {
  const productionConfig = await resolveConfig({
    root: REPO_ROOT,
    configFile: path.join(REPO_ROOT, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
  }, 'build', 'production');
  const guard = productionConfig.plugins.find(plugin => plugin.name === 'tea-reference-production-leak-guard');
  assert.ok(guard, 'normal production config must install the preview leak guard');
  const pluginContext = { error(message) { throw new Error(message); } };
  assert.doesNotThrow(() => guard.generateBundle.call(pluginContext, {}, {
    'safe.js': { type: 'chunk', modules: { [path.join(REPO_ROOT, 'src/pages/wisdom/WisdomHomePage.tsx')]: {} } },
  }));
  assert.throws(() => guard.generateBundle.call(pluginContext, {}, {
    'leaked.js': { type: 'chunk', modules: { [path.join(REPO_ROOT, 'src/wisdom/reference/client.ts')]: {} } },
  }), /Tea Reference preview modules leaked.*client\.ts/i);

  const previewConfig = await resolveConfig({
    root: REPO_ROOT,
    configFile: path.join(REPO_ROOT, 'vite.config.ts'),
    mode: 'tea-reference-preview',
    logLevel: 'silent',
  }, 'build', 'tea-reference-preview');
  assert.equal(
    previewConfig.plugins.some(plugin => plugin.name === 'tea-reference-production-leak-guard'),
    false,
  );
});

test('client-rendered preview home withholds Types while loading and after a bounded error', { timeout: 120000 }, async t => {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-client-states-')));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await fs.symlink(path.join(REPO_ROOT, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  const previewModule = path.join(REPO_ROOT, 'src/pages/wisdom/PreviewWisdomHomePage.tsx');
  await fs.writeFile(path.join(temp, 'index.html'), '<main id="root"></main><script type="module" src="/main.tsx"></script>');
  await fs.writeFile(path.join(temp, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { HelmetProvider } from 'react-helmet-async';
    import { MemoryRouter } from 'react-router-dom';
    import PreviewWisdomHomePage from '@preview-home';

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    createRoot(document.getElementById('root')!).render(
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/wisdom']}>
            <PreviewWisdomHomePage />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
  `);

  const outDir = path.join(temp, 'dist');
  await build({
    root: temp,
    configFile: false,
    mode: 'tea-reference-preview',
    plugins: [react()],
    resolve: { alias: { '@': path.join(REPO_ROOT, 'src'), '@preview-home': previewModule } },
    define: { __BUILD_ID__: JSON.stringify('client-state-test') },
    build: { outDir, emptyOutDir: true },
    logLevel: 'silent',
  });
  const server = await serveStaticSpa(outDir);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const executablePath = await installedChromiumExecutable();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  t.after(() => browser.close());

  const loadingPage = await browser.newPage();
  const pageErrors = [];
  loadingPage.on('pageerror', error => pageErrors.push(error.message));
  await loadingPage.route('**/api/products/public', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  let pendingPreviewRequest;
  await loadingPage.route('**/__tea-reference-preview*', route => { pendingPreviewRequest = route; });
  await loadingPage.goto(`${origin}/wisdom`, { waitUntil: 'domcontentloaded' });
  await loadingPage.waitForTimeout(1000);
  assert.deepEqual(pageErrors, []);
  await loadingPage.getByRole('heading', { name: 'The Tea Wisdom Base' }).waitFor();
  assert.equal(await loadingPage.getByRole('link', { name: 'Tea Types', exact: true }).count(), 0);
  assert.equal((await loadingPage.locator('body').innerText()).includes('Tea Types\n0 entries'), false);
  await pendingPreviewRequest?.abort();
  await loadingPage.close();

  const errorPage = await browser.newPage();
  await errorPage.route('**/api/products/public', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await errorPage.route('**/__tea-reference-preview*', route => route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Tea Reference preview could not be loaded.' }),
  }));
  await errorPage.goto(`${origin}/wisdom`, { waitUntil: 'domcontentloaded' });
  await errorPage.getByText('The local cited preview is unavailable', { exact: false }).waitFor();
  assert.equal(await errorPage.getByRole('link', { name: 'Tea Types', exact: true }).count(), 0);
  assert.equal(await errorPage.getByRole('link', { name: 'The Tea Plants', exact: true }).count(), 1);
});
