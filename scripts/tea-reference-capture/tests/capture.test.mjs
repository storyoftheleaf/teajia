import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { captureBatch } from '../capture.mjs';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const specialistHtml = await fs.readFile(path.join(fixtureDir, 'specialist-article.html'), 'utf8');
const tbrsHtml = await fs.readFile(path.join(fixtureDir, 'tbrs-cultivar.html'), 'utf8');

function source(overrides) {
  return {
    sourceId: 'specialist-yiwu',
    url: 'https://example.test/yiwu',
    publisher: 'Example Specialist',
    publisherRole: 'specialist_editorial',
    sourceFamily: 'specialist-article',
    language: 'en',
    accessPolicy: 'allowed',
    adapter: 'specialist-article',
    adapterVersion: '1',
    permittedEntityKinds: ['tea_area'],
    permittedClaimScopes: ['geography', 'processing', 'common_characteristics', 'historical', 'identity'],
    rateLimitMs: 0,
    ...overrides,
  };
}

const allowlist = {
  schemaVersion: 1,
  sources: [
    source({}),
    source({
      sourceId: 'tbrs-qingxin',
      url: 'https://example.test/qingxin',
      publisher: 'Taiwan Tea and Beverage Research Station',
      publisherRole: 'institute',
      sourceFamily: 'tbrs-cultivar',
      language: 'zh-Hant',
      adapter: 'tbrs-cultivar',
      permittedEntityKinds: ['cultivar'],
      permittedClaimScopes: ['identity', 'cultivar_potential'],
    }),
  ],
};

function fixtureFetcher(fixtures) {
  return async (url) => {
    const value = fixtures[url];
    if (value instanceof Error) throw value;
    if (value === undefined) return new Response('not found', { status: 404 });
    return new Response(value, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
}

test('capture stores private originals, hashes, exact evidence and stable claims', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-capture-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const fetcher = fixtureFetcher({
    'https://example.test/yiwu': specialistHtml,
    'https://example.test/qingxin': tbrsHtml,
  });

  const now = () => new Date('2030-02-03T08:00:00+08:00');
  const first = await captureBatch({ allowlist, outputRoot: path.join(temp, 'run-1'), fetcher, now });
  const second = await captureBatch({ allowlist, outputRoot: path.join(temp, 'run-2'), fetcher, previousRun: path.join(temp, 'run-1'), now });

  assert.equal(first.manifest.complete, true);
  assert.equal(first.manifest.sourceCount, 2);
  assert.equal(first.manifest.errorCount, 0);
  assert.equal(first.manifest.relationshipGroupCount, 0);
  assert.equal(first.manifest.differentScopeRelationshipCount, 0);
  assert.equal(first.manifest.genuineContradictionCount, 0);
  assert.equal(first.manifest.entityResolutionCandidateCount, 2);
  assert.equal(first.manifest.autoMergeCandidateCount, 0);
  assert.equal(first.manifest.duplicateSnapshotGroupCount, 0);
  assert.equal(first.manifest.continualCaptureEligible, true);
  assert.ok(first.sources.every((packet) => /^[a-f0-9]{64}$/.test(packet.retrieval.originalSha256)));
  assert.ok(first.sources.every((packet) => /^[a-f0-9]{64}$/.test(packet.retrieval.normalizedSha256)));
  assert.ok(first.sources.every((packet) => packet.retrieval.accessedDate === '2030-02-03'));
  assert.equal(await fs.readFile(path.join(temp, 'run-1', 'sources', 'specialist-yiwu', 'original.html'), 'utf8'), specialistHtml);
  assert.equal(JSON.parse(await fs.readFile(path.join(temp, 'run-1', 'relationships.json'), 'utf8')).length, 0);
  assert.equal(JSON.parse(await fs.readFile(path.join(temp, 'run-1', 'entity-resolution.json'), 'utf8')).length, 2);
  const websiteHandoff = JSON.parse(await fs.readFile(path.join(temp, 'run-1', 'website-handoff.json'), 'utf8'));
  assert.equal(websiteHandoff.manifest.mode, 'preview-only');
  assert.equal(websiteHandoff.manifest.readyToPublishCount, 0);
  assert.equal(websiteHandoff.claims.length, 6);

  const claimBytes1 = await fs.readFile(path.join(temp, 'run-1', 'claims.json'));
  const claimBytes2 = await fs.readFile(path.join(temp, 'run-2', 'claims.json'));
  assert.deepEqual(claimBytes1, claimBytes2);
  assert.deepEqual(second.preview, { added: 0, changed: 0, unchanged: 6, missing: 0 });
  for (const evidence of first.evidence) {
    const packet = first.sources.find(({ source }) => source.sourceId === evidence.sourceId);
    assert.equal(packet.normalizedText.slice(evidence.start, evidence.end), evidence.exact);
  }
});

test('a failed source is recorded and makes the batch incomplete', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-capture-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const failed = await captureBatch({
    allowlist,
    outputRoot: path.join(temp, 'failed-run'),
    fetcher: fixtureFetcher({
      'https://example.test/yiwu': specialistHtml,
      'https://example.test/qingxin': new Error('network unavailable'),
    }),
  });
  assert.equal(failed.manifest.complete, false);
  assert.equal(failed.manifest.continualCaptureEligible, false);
  assert.equal(failed.errors.length, 1);
  assert.equal(failed.errors[0].sourceId, 'tbrs-qingxin');
  assert.match(failed.errors[0].message, /network unavailable/);
});

test('identical normalized snapshots from different URLs block continual capture eligibility', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-capture-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const duplicateAllowlist = {
    schemaVersion: 1,
    sources: [
      source({ sourceId: 'specialist-one', url: 'https://example.test/one' }),
      source({ sourceId: 'specialist-two', url: 'https://example.test/two' }),
    ],
  };
  const capture = await captureBatch({
    allowlist: duplicateAllowlist,
    outputRoot: path.join(temp, 'duplicate-run'),
    fetcher: fixtureFetcher({
      'https://example.test/one': specialistHtml,
      'https://example.test/two': specialistHtml,
    }),
  });
  assert.equal(capture.manifest.complete, true);
  assert.equal(capture.manifest.duplicateSnapshotGroupCount, 1);
  assert.equal(capture.manifest.continualCaptureEligible, false);
});

test('preview reports added and missing claims without changing the previous run', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-capture-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const firstRoot = path.join(temp, 'run-1');
  await captureBatch({
    allowlist,
    outputRoot: firstRoot,
    fetcher: fixtureFetcher({ 'https://example.test/yiwu': specialistHtml, 'https://example.test/qingxin': tbrsHtml }),
  });
  const originalClaims = await fs.readFile(path.join(firstRoot, 'claims.json'));
  const changedHtml = specialistHtml.replace('a softer bitterness', 'a firmer bitterness');
  const next = await captureBatch({
    allowlist,
    outputRoot: path.join(temp, 'run-2'),
    previousRun: firstRoot,
    fetcher: fixtureFetcher({ 'https://example.test/yiwu': changedHtml, 'https://example.test/qingxin': tbrsHtml }),
  });
  assert.equal(next.preview.added, 1);
  assert.equal(next.preview.missing, 1);
  assert.equal(next.preview.unchanged, 5);
  assert.deepEqual(await fs.readFile(path.join(firstRoot, 'claims.json')), originalClaims);
});

test('rejects unsafe source identifiers before writing output', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-capture-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await assert.rejects(
    captureBatch({
      allowlist: { schemaVersion: 1, sources: [source({ sourceId: '../escape' })] },
      outputRoot: path.join(temp, 'run'),
      fetcher: fixtureFetcher({}),
    }),
    /source id/i,
  );
});
