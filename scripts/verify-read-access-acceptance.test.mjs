import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReadAcceptance } from './verify-read-access-acceptance.mjs';
import { createHash } from 'node:crypto';

const candidate = 'f1bb0e30e32fd9a8bea5ef29c123946b49711b7e';
const versionId = '12345678-1234-1234-1234-123456789abc';
const deployURL = 'https://abc123.teajiafinal.pages.dev';
const privateAsset = '/read-assets/read-content-private-PRIVATE1.js';
const publicAsset = '/read-assets/read-content-public-PUBLIC01.js';
const entry = JSON.stringify([privateAsset, publicAsset]);
const version = JSON.stringify({ buildId: 'build-7' });
const metadata = { candidate, defaults: { '/read/draft': false, '/read/live': true }, assets: [
  { asset: '/read-assets/read-content-private-LOCALAAA.js', paths: ['/read/draft'] }, { asset: '/read-assets/read-content-public-LOCALBBB.js', paths: ['/read/live'] },
] };
const hash = text => createHash('sha256').update(text).digest('hex');
const artifact = { revision: candidate, tree: 'c'.repeat(40), runId: 123, runAttempt: 1, buildId: 'build-7', files: { '/index.html': hash('<root>'), '/assets/index-fixture.js': hash(entry), '/version.json': hash(version) } };
const state = { status: 'live', candidate, runId: 123, runAttempt: 1, workerProof: { status: 'worker_verified', revision: candidate, versionId }, result: {
  state: 'live', candidate, worker: { revision: candidate, versionId }, deploymentUrl: deployURL, buildId: 'build-7', sourceTree: artifact.tree, proof: { buildId: 'build-7', hashes: { '/': artifact.files['/index.html'], '/assets/index-fixture.js': artifact.files['/assets/index-fixture.js'], '/version.json': artifact.files['/version.json'] } },
} };
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };

function fake(options = {}) {
  let stateReads = 0;
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, method: init.method });
    if (options.protected && url.startsWith(deployURL) && init.method === 'HEAD') {
      return new Response(null, { status: 302, headers: { Location: `${options.badLogin ? 'https://attacker.example' : 'https://soft-band-fe5b.cloudflareaccess.com'}/cdn-cgi/access/login/abc123.teajiafinal.pages.dev?opaque=never-persist` } });
    }
    if (url.endsWith('/assets/index-fixture.js')) return new Response(options.wrongEntry ? 'wrong bytes' : entry);
    if (url.endsWith('/version.json')) return new Response(options.wrongBuild ? '{}' : version);
    if (url.endsWith('/api/public/read/publish-state')) return Response.json({ states: ++stateReads === 2 && options.changedState ? { '/read/draft': 'live' } : {} });
    if (url.endsWith('/api/release')) return Response.json({ revision: options.wrongRevision ? 'b'.repeat(40) : candidate, versionId });
    if (url === `https://teajia.com${privateAsset}`) return new Response(null, { status: 301, headers: { Location: `https://www.teajia.com${privateAsset}` } });
    if (url.endsWith(privateAsset)) return new Response(null, { status: options.privateAllowed ? 200 : 404, headers });
    if (url.endsWith(publicAsset)) return new Response(null, { status: options.publicUnavailable ? 503 : 200, headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
    throw new Error('Unexpected request');
  };
  return { fetcher, calls };
}

test('proves private denial and public delivery using only HEAD for modules', async () => {
  const { fetcher, calls } = fake();
  const proof = await verifyReadAcceptance({ state, metadata, artifact, fetcher });
  assert.equal(proof.privateAsset, privateAsset);
  assert.equal(proof.publicAsset, publicAsset);
  assert.equal(proof.publicationStatesUnchanged, true);
  assert.equal(calls.filter(x => x.url.includes('/read-assets/')).length, 5);
  assert.ok(calls.filter(x => x.url.includes('/read-assets/')).every(x => x.method === 'HEAD'));
});

test('refuses an anonymously public draft asset', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ privateAllowed: true }).fetcher }), /Private Read asset mismatch/);
});

test('refuses unavailable public delivery even when privacy fails closed', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ publicUnavailable: true }).fetcher }), /Public Read asset mismatch/);
});

test('refuses a Worker revision different from the release candidate', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ wrongRevision: true }).fetcher }), /Live Worker revision mismatch/);
});

test('refuses publication state changes during acceptance', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ changedState: true }).fetcher }), /Publication states mismatch/);
});

test('refuses public entry bytes that differ from the immutable release artifact', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ wrongEntry: true }).fetcher }), /Recorded public JavaScript bytes mismatch/);
});

test('refuses a canonical build different from the recorded deployment', async () => {
  await assert.rejects(verifyReadAcceptance({ state, metadata, artifact, fetcher: fake({ wrongBuild: true }).fetcher }), /Canonical version bytes mismatch/);
});
test('protected immutable Read host keeps public 404/200 and exact Access boundary', async () => {
  const protectedState = structuredClone(state);
  protectedState.result.proofMethod = 'canonical-bytes-and-cloudflare-deployment';
  protectedState.result.deploymentId = 'deployment-id';
  const project = { name: 'teajiafinal', production_branch: 'main', domains: ['teajia.com', 'www.teajia.com'], canonical_deployment: {
    id: 'deployment-id', url: deployURL, environment: 'production', latest_stage: { name: 'deploy', status: 'success' },
    deployment_trigger: { metadata: { commit_hash: candidate } },
  } };
  const f = fake({ protected: true });
  const loginOrigin = 'https://soft-band-fe5b.cloudflareaccess.com';
  const proof = await verifyReadAcceptance({ state: protectedState, metadata, artifact, fetcher: f.fetcher, project: async () => project, loginOrigin });
  assert.equal(proof.proofMethod, 'canonical-bytes-and-cloudflare-deployment');
  assert.equal(proof.checks.filter(x => x.kind === 'access-protected').length, 2);
  assert.ok(f.calls.filter(x => x.url.startsWith(deployURL)).every(x => x.method === 'HEAD'));
  assert.equal(JSON.stringify(proof).includes('never-persist'), false);
  await assert.rejects(verifyReadAcceptance({ state: protectedState, metadata, artifact, fetcher: fake({ protected: true, badLogin: true }).fetcher, project: async () => project, loginOrigin }), /Access boundary missing/);
  await assert.rejects(verifyReadAcceptance({ state: protectedState, metadata, artifact, fetcher: fake({ protected: true }).fetcher,
    project: async () => ({ ...project, canonical_deployment: { ...project.canonical_deployment, deployment_trigger: { metadata: { commit_hash: 'x' } } } }), loginOrigin }), /exact production candidate/);
});
