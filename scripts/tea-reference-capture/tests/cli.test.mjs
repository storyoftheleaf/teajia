import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseCliArgs, runCli } from '../cli.mjs';

const allowlist = {
  schemaVersion: 1,
  sources: [{
    sourceId: 'specialist-yiwu', url: 'https://example.test/yiwu', publisher: 'Example Specialist',
    publisherRole: 'specialist_editorial', sourceFamily: 'specialist-article', language: 'en', accessPolicy: 'allowed',
    adapter: 'specialist-article', adapterVersion: '1', permittedEntityKinds: ['tea_area'],
    permittedClaimScopes: ['geography', 'processing', 'common_characteristics', 'identity'], rateLimitMs: 0,
  }],
};
const html = '<html><head><meta name="author" content="Researcher"></head><body><article><h1>Yiwu</h1><h2>Geography</h2><p>Yiwu is a tea area.</p></article></body></html>';

test('CLI accepts only preview inputs and writes beneath the capture output area', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-cli-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const allowlistPath = path.join(cwd, 'allowlist.json');
  await fs.writeFile(allowlistPath, JSON.stringify(allowlist));
  const workbookWriter = async ({ outputPath }) => fs.writeFile(outputPath, 'workbook fixture');
  const result = await runCli({
    argv: ['--allowlist', allowlistPath, '--output', 'outputs/tea-reference-capture/pilot'],
    cwd,
    fetcher: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    workbookWriter,
    artifactTool: {},
  });
  assert.equal(result.manifest.complete, true);
  assert.equal(await fs.readFile(path.join(cwd, 'outputs/tea-reference-capture/pilot/review.xlsx'), 'utf8'), 'workbook fixture');
  assert.equal(JSON.parse(await fs.readFile(path.join(cwd, 'outputs/tea-reference-capture/pilot/manifest.json'), 'utf8')).captureMode, 'preview-only');
});

test('CLI rejects output outside outputs/tea-reference-capture', async () => {
  await assert.rejects(
    runCli({ argv: ['--allowlist', '/tmp/allowlist.json', '--output', '../escape'], cwd: '/tmp' }),
    /output.*outputs\/tea-reference-capture/i,
  );
});

test('CLI has no apply, publish or assimilation flags', () => {
  assert.throws(() => parseCliArgs(['--allowlist', 'a.json', '--output', 'outputs/tea-reference-capture/a', '--apply']), /unknown argument.*apply/i);
  assert.throws(() => parseCliArgs(['--publish']), /unknown argument.*publish/i);
  assert.throws(() => parseCliArgs(['--assimilate']), /unknown argument.*assimilate/i);
});
