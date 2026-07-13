import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanChinaDependencies, verifyBuiltReachabilityPolicy } from './check-china-dependencies.mjs';

test('repository has no blocked stock-media references in runtime source or public policy', async () => {
  const repositoryRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const result = await scanChinaDependencies(repositoryRoot);
  const sourceAndPublicMedia = result.inventory.filter(({ file, kind }) =>
    kind === 'blocked-media' && (file.startsWith('src/') || file.startsWith('public/'))
  );
  assert.deepEqual(sourceAndPublicMedia, []);
});

test('flags an injected Worker origin in an executable production chunk', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-built-origin-'));
  await mkdir(join(root, 'dist', 'assets'), { recursive: true });
  await writeFile(join(root, 'dist', 'assets', 'app.js'), "fetch('https://teajia-api.lightcodes.workers.dev/api/inquiries')");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(({ file, kind }) => ({ file, kind })), [
    { file: 'dist/assets/app.js', kind: 'browser-api-origin' },
  ]);
});

test('flags blocked runtime media and browser Worker origins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'bad.ts'), "export const x='https://images.unsplash.com/a'; const api='https://teajia-api.lightcodes.workers.dev';");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(v => v.kind).sort(), ['blocked-media', 'browser-api-origin']);
  assert.deepEqual(result.violations.map(v => v.line), [1, 1]);
});

test('ignores tests, source maps, and configured edge upstreams', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'tests'), { recursive: true });
  await mkdir(join(root, 'functions', 'api'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'tests', 'fixture.spec.ts'), "const image='https://images.unsplash.com/fixture';");
  await writeFile(join(root, 'src', 'bundle.js.map'), 'https://picsum.photos/map');
  await writeFile(join(root, 'functions', 'api', '[[path]].ts'), 'const upstream=context.env.WORKER_ORIGIN;');
  const result = await scanChinaDependencies(root);
  assert.equal(result.violations.length, 0);
});

test('fails a literal Worker origin in edge code while configured env upstream passes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'functions'), { recursive: true });
  await writeFile(join(root, 'functions', '_middleware.ts'), "const old='https://teajia-api.lightcodes.workers.dev';");
  const result = await scanChinaDependencies(root);
  assert.equal(result.violations.length, 1);
  assert.deepEqual(result.inventory.map(item => item.kind), ['edge-origin']);
});

test('flags protocol-relative, http, CSS imports, and api.teajia.com browser origins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'bad.css'), "@import '//fonts.gstatic.com/font';a{background:url(http://picsum.photos/2)}\n.x{--api:'//api.teajia.com'}");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(v => v.kind).sort(), ['blocked-media', 'browser-api-origin', 'google-font-runtime']);
});

test('reports Google font runtime dependencies with exact source lines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'public'), { recursive: true });
  await writeFile(join(root, 'public', 'fonts.css'), "local\n@import url('https://fonts.googleapis.com/css2');");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(({ kind, line }) => ({ kind, line })), [{ kind: 'google-font-runtime', line: 2 }]);
});

test('ignores generated chunks proven by the Vite manifest to contain documentation only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'dist', '.vite'), { recursive: true });
  await mkdir(join(root, 'dist', 'assets'), { recursive: true });
  await writeFile(join(root, 'dist', '.vite', 'manifest.json'), JSON.stringify({
    'docs/guide.md': { file: 'assets/guide.js', src: 'docs/guide.md' },
    'src/main.tsx': { file: 'assets/app.js', src: 'src/main.tsx' },
  }));
  await writeFile(join(root, 'dist', 'assets', 'guide.js'), "export default 'https://api.teajia.com prose'");
  await writeFile(join(root, 'dist', 'assets', 'app.js'), "fetch('https://api.teajia.com/runtime')");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(v => v.file), ['dist/assets/app.js']);
});

test('scans a documentation chunk when a runtime entry imports it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'dist', '.vite'), { recursive: true });
  await mkdir(join(root, 'dist', 'assets'), { recursive: true });
  await writeFile(join(root, 'dist', '.vite', 'manifest.json'), JSON.stringify({
    'docs/guide.md': { file: 'assets/guide.js', src: 'docs/guide.md' },
    'src/main.tsx': { file: 'assets/app.js', src: 'src/main.tsx', imports: ['docs/guide.md'] },
  }));
  await writeFile(join(root, 'dist', 'assets', 'guide.js'), "fetch('https://api.teajia.com/runtime')");
  await writeFile(join(root, 'dist', 'assets', 'app.js'), "import './guide.js'");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(v => v.file), ['dist/assets/guide.js']);
});

test('built policy requires same-origin API/media routes, no runtime Google Fonts, and uncached OTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-built-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', '_headers'), '/api/verify/request\n  Cache-Control: no-store\n/api/verify/confirm\n  Cache-Control: no-store');
  await writeFile(join(root, 'dist', 'sw.js'), `registerRoute(({url})=>url.pathname.startsWith('/api/'),NetworkFirst,'GET');registerRoute(({url})=>url.pathname.startsWith('/media/'),CacheFirst,'GET')`);
  assert.deepEqual(await verifyBuiltReachabilityPolicy(root), []);
  await writeFile(join(root, 'dist', 'sw.js'), "'https://fonts.googleapis.com/'");
  assert.ok((await verifyBuiltReachabilityPolicy(root)).length > 0);
});

test('built policy accepts a self-destroying cleanup worker with no fetch cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-built-cleanup-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', '_headers'), '/api/verify/request\n  Cache-Control: no-store\n/api/verify/confirm\n  Cache-Control: no-store');
  await writeFile(join(root, 'dist', 'sw.js'), "self.addEventListener('activate',()=>self.registration.unregister().then(()=>caches.keys()).then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));");
  assert.deepEqual(await verifyBuiltReachabilityPolicy(root), []);
});
