import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanChinaDependencies } from './check-china-dependencies.mjs';

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

test('classifies a literal Worker origin in edge code as inventory, not browser runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'functions'), { recursive: true });
  await writeFile(join(root, 'functions', '_middleware.ts'), "const old='https://teajia-api.lightcodes.workers.dev';");
  const result = await scanChinaDependencies(root);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.inventory.map(item => item.kind), ['edge-origin']);
});

test('reports Google font runtime dependencies with exact source lines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'public'), { recursive: true });
  await writeFile(join(root, 'public', 'fonts.css'), "local\n@import url('https://fonts.googleapis.com/css2');");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(({ kind, line }) => ({ kind, line })), [{ kind: 'google-font-runtime', line: 2 }]);
});
