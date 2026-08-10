import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

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

  const normalServer = await createServer({
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

  const previewServer = await createServer({
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
