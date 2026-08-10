import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { canonicalJson, sha256 } from '../../tea-reference-capture/canonical.mjs';
import { teaReferencePreviewPlugin } from '../vite-plugin.mjs';

function handoff() {
  const entities = [{
    resolutionId: 'RESOLUTION-YIWU',
    canonicalEntityId: '',
    preferredLabel: 'Greater Yiwu',
    sourceLabel: 'Greater Yiwu',
    entityKind: 'tea_area',
    websiteHolding: 'regions',
    proposedAction: 'hold',
    resolutionStatus: 'hold_unresolved',
    reason: 'PRIVATE ENTITY REASON',
    claimIds: ['CLAIM-COMMON'],
  }];
  const citations = [{
    citationId: 'CITATION-SOURCE-EVIDENCE',
    sourceId: 'source',
    evidenceId: 'PRIVATE-EVIDENCE-ID',
    publisher: 'Example Specialist',
    publisherRole: 'specialist_editorial',
    title: 'Greater Yiwu',
    author: 'Researcher',
    publishedDate: '2024-04-10',
    accessedDate: '2026-08-10',
    url: 'https://example.test/yiwu',
  }];
  const claims = [{
    claimId: 'CLAIM-COMMON',
    resolutionId: 'RESOLUTION-YIWU',
    canonicalEntityId: '',
    subject: 'Greater Yiwu',
    entityKind: 'tea_area',
    claimScope: 'common_characteristics',
    websiteHolding: 'regions',
    websiteField: 'commonCharacteristics',
    candidateValue: 'A public-safe cited description.',
    qualifiers: {},
    assertingPublisherRole: 'specialist_editorial',
    compatibility: 'requires_model_extension',
    citationId: 'CITATION-SOURCE-EVIDENCE',
    proposedAction: 'hold',
    holdReason: 'PRIVATE CLAIM REASON',
    payloadSha256: 'private-claim-hash',
  }];
  const heldBack = [{ claimId: 'CLAIM-COMMON', reason: 'PRIVATE HELD REASON' }];
  const payload = { entities, claims, citations, heldBack };
  return {
    manifest: {
      schemaVersion: 1,
      siteModel: 'tea-wisdom-v1',
      mode: 'preview-only',
      claimsSha256: 'private-claims-hash',
      sourceSnapshotSha256: 'private-sources-hash',
      entityCount: entities.length,
      claimCount: claims.length,
      citationCount: citations.length,
      readyToPublishCount: 0,
      heldBackCount: heldBack.length,
      payloadSha256: sha256(canonicalJson(payload)),
    },
    ...payload,
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value = '') {
      this.body += value;
    },
  };
}

function configuredMiddleware(plugin) {
  let middleware;
  plugin.configureServer({
    middlewares: {
      use(candidate) {
        middleware = candidate;
      },
    },
  });
  assert.equal(typeof middleware, 'function');
  return middleware;
}

test('adapter is absent outside Vite serve in tea-reference-preview mode', () => {
  assert.equal(teaReferencePreviewPlugin({ command: 'build', mode: 'tea-reference-preview', handoffPath: 'handoff.json' }), null);
  assert.equal(teaReferencePreviewPlugin({ command: 'serve', mode: 'development', handoffPath: 'handoff.json' }), null);
});

test('endpoint returns only public transport with no-store caching', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-vite-adapter-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  await fs.writeFile(handoffPath, JSON.stringify(handoff()));
  const plugin = teaReferencePreviewPlugin({ command: 'serve', mode: 'tea-reference-preview', handoffPath });
  const middleware = configuredMiddleware(plugin);
  const response = responseRecorder();
  let nextCalled = false;

  await middleware({ url: '/__tea-reference-preview?fresh=1' }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader('cache-control'), 'no-store');
  assert.match(response.getHeader('content-type'), /^application\/json/);
  const transport = JSON.parse(response.body);
  assert.deepEqual(Object.keys(transport), ['manifest', 'publicPreview']);
  assert.equal(transport.publicPreview.sections[0].entries[0].statements[0].excerpt, 'A public-safe cited description.');
  assert.doesNotMatch(
    response.body,
    /PRIVATE|operations|projectedState|privateVerification|evidenceIds?|holdReason|candidateValue|(?:inputPayload|sourceSnapshot|payload)Sha256/i,
  );
});

test('adapter passes every other request through', async () => {
  const middleware = configuredMiddleware(teaReferencePreviewPlugin({
    command: 'serve',
    mode: 'tea-reference-preview',
    handoffPath: '/does/not/need/to/exist.json',
  }));
  const response = responseRecorder();
  let nextCalled = false;

  await middleware({ url: '/__tea-reference-preview/extra' }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(response.body, '');
});

test('invalid input returns a bounded generic 422 without raw details', async () => {
  const handoffPath = '/private/research/PRIVATE-CANDIDATE.json';
  const middleware = configuredMiddleware(teaReferencePreviewPlugin({
    command: 'serve',
    mode: 'tea-reference-preview',
    handoffPath,
  }));
  const response = responseRecorder();

  await middleware({ url: '/__tea-reference-preview' }, response, () => assert.fail('endpoint passed through'));

  assert.equal(response.statusCode, 422);
  assert.equal(response.getHeader('cache-control'), 'no-store');
  assert.deepEqual(JSON.parse(response.body), { error: 'Tea Reference preview could not be loaded.' });
  assert.ok(response.body.length < 100);
  assert.doesNotMatch(response.body, /PRIVATE|CANDIDATE|research|ENOENT|no such file/i);
});
