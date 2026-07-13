import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanChinaDependencies, verifyBuiltReachabilityPolicy } from './check-china-dependencies.mjs';

test('repository keeps only the reviewed live stock-media references and CSP declarations', async () => {
  const repositoryRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const result = await scanChinaDependencies(repositoryRoot);
  const sourceAndPublicMedia = result.inventory.filter(({ file, kind }) =>
    kind === 'blocked-media' && (file.startsWith('src/') || file.startsWith('public/'))
  );
  const reviewedReferences = new Map();
  for (const { file, value } of sourceAndPublicMedia) {
    const key = `${file} | ${value}`;
    reviewedReferences.set(key, (reviewedReferences.get(key) ?? 0) + 1);
  }
  assert.deepEqual(
    [...reviewedReferences].sort(([left], [right]) => left.localeCompare(right)),
    [
      ['public/_headers | https://images.unsplash.com', 1],
      ['public/_headers | https://picsum.photos', 1],
    ],
  );
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

test('built policy requires same-origin API/media routes, no runtime Google Fonts, and uncached OTP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-built-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', '_headers'), '/api/verify/request\n  Cache-Control: no-store\n/api/verify/confirm\n  Cache-Control: no-store');
  await writeFile(join(root, 'dist', 'sw.js'), `registerRoute(({url})=>url.pathname.startsWith('/api/'),NetworkFirst,'GET');registerRoute(({url})=>url.pathname.startsWith('/media/'),CacheFirst,'GET')`);
  assert.deepEqual(await verifyBuiltReachabilityPolicy(root), []);
  await writeFile(join(root, 'dist', 'sw.js'), "'https://fonts.googleapis.com/'");
  assert.ok((await verifyBuiltReachabilityPolicy(root)).length > 0);
});
