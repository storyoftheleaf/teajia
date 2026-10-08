import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease, productionDeployment, assetPaths, proofMatches } from './publish-verified-release.mjs';
test('requires immutable full revisions', () => {
  assert.throws(() => validateRelease('main', 'a'.repeat(40)));
  assert.throws(() => validateRelease('a'.repeat(40), 'latest'));
  validateRelease('a'.repeat(40), 'b'.repeat(40));
});
test('only accepts production deployments for the exact candidate', () => {
  const row = (id, environment, commit_hash) => ({ id, environment, deployment_trigger: { metadata: { commit_hash } } });
  assert.equal(productionDeployment([row('preview', 'preview', 'a'), row('old', 'production', 'b'), row('yes', 'production', 'a')], 'a').id, 'yes');
  assert.equal(productionDeployment([row('no', 'production', 'ab')], 'a'), undefined);
});
test('proof hashes local built assets only, including CSS and module preload', () => {
  assert.deepEqual(assetPaths('<script src="/assets/a.js"></script><link href="/assets/b.css"><link href="/assets/a.js"><a href="https://other/a.js">'), ['/assets/a.js', '/assets/b.css']);
});
test('requires identical build ID and bytes', () => {
  const a = { buildId: 12, hashes: { '/': 'abc' } };
  assert.equal(proofMatches(a, structuredClone(a)), true);
  assert.equal(proofMatches(a, { ...a, buildId: 13 }), false);
  assert.equal(proofMatches(a, { ...a, hashes: { '/': 'def' } }), false);
});

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './publish-verified-release.mjs';
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'teajia-release-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const candidate = 'a'.repeat(40), expected = 'b'.repeat(40);
  const env = { CANDIDATE_SHA: candidate, EXPECTED_MAIN_SHA: expected, RELEASE_STATE_PATH: join(dir, 'state.json'), WORKER_PROOF_PATH: join(dir, 'worker.json'), CLOUDFLARE_ACCOUNT_ID: 'test' };
  writeFileSync(env.WORKER_PROOF_PATH, JSON.stringify({ status: 'worker_verified', revision: candidate, versionId: 'v1' }));
  let main = options.main || expected;
  let clock = 0;
  let immutableReads = 0;
  const mutations = [];
  const fetch = async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/deployments')) assert.equal(new URL(url).searchParams.get('per_page'), '20');
    if (path.endsWith('/deployments')) return Response.json({ success: true, result: [{ id: 'd1', environment: 'production', deployment_trigger: { metadata: { commit_hash: candidate } }, latest_stage: { status: 'success' }, url: 'https://abc.teajiafinal.pages.dev' }] });
    if (path.includes('/pages/projects/')) return Response.json({ success: true, result: { production_branch: 'main', domains: ['teajia.com'] } });
    if (path === '/api/release') return Response.json({ revision: options.workerRevision || candidate, versionId: 'v1' });
    if (path === '/version.json') return Response.json({ buildId: 42 });
    if (path === '/') return new Response('<script src="/assets/app.js"></script>');
    if (new URL(url).host === 'abc.teajiafinal.pages.dev' && path === '/assets/app.js') {
      immutableReads++;
      if (options.assetAlwaysMissing || (options.assetInitiallyMissing && immutableReads === 1)) return new Response('', { status: 404 });
      if (options.assetDenied) return new Response('', { status: 403 });
    }
    return new Response('app bytes');
  };
  const git = (...args) => {
    if (args[0] === 'ls-remote') return `${main}\trefs/heads/main`;
    if (args[0] === 'merge-base') return '';
    if (args[0] === 'push') { mutations.push(args); main = candidate; return ''; }
    throw new Error(`unexpected git ${args}`);
  };
  return { env, dependencies: { fetch, git, now: () => clock, sleep: async () => { main = candidate; clock += options.assetAlwaysMissing ? 20 * 60_000 : 15_000; } }, mutations, immutableReads: () => immutableReads, state: () => JSON.parse(readFileSync(env.RELEASE_STATE_PATH, 'utf8')) };
}
test('never advances main for a different live worker', async t => {
  const f = fixture(t, { workerRevision: 'c'.repeat(40) });
  await assert.rejects(run(f.env, false, f.dependencies), /Worker does not match/);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'failed');
});
test('never advances main over a competing release', async t => {
  const f = fixture(t, { main: 'c'.repeat(40) });
  await assert.rejects(run(f.env, false, f.dependencies), /Main changed/);
  assert.equal(f.mutations.length, 0);
});
test('waits for external publisher and persists independent immutable/live proof', async t => {
  const f = fixture(t);
  await run(f.env, false, f.dependencies);
  assert.equal(f.mutations.length, 0);
  assert.equal(f.state().state, 'live'); assert.equal(f.state().buildId, 42);
  assert.ok(f.state().proof.hashes['/assets/app.js']);
});
test('resumes observation without publishing main again', async t => {
  const f = fixture(t, { main: 'a'.repeat(40) });
  await run(f.env, false, f.dependencies);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'live');
});
test('preflight verifies Pages permissions without publishing', async t => {
  const f = fixture(t);
  await run(f.env, 'preflight', f.dependencies);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'preflight_passed');
});
test('retries a transient immutable asset 404 and still proves every asset hash', async t => {
  const f = fixture(t, { main: 'a'.repeat(40), assetInitiallyMissing: true });
  await run(f.env, false, f.dependencies);
  assert.equal(f.immutableReads(), 2);
  assert.equal(f.state().state, 'live');
  assert.equal(f.state().proof.hashes['/assets/app.js'].length, 64);
  assert.equal(f.mutations.length, 0);
});
test('a missing immutable asset times out without accepting partial proof', async t => {
  const f = fixture(t, { main: 'a'.repeat(40), assetAlwaysMissing: true });
  await assert.rejects(run(f.env, false, f.dependencies), /Immutable deployment proof timed out: Read failed: abc\.teajiafinal\.pages\.dev\/assets\/app\.js HTTP 404/);
  assert.equal(f.state().state, 'failed');
  assert.equal(f.state().proof, undefined);
  assert.equal(f.mutations.length, 0);
});
test('a refused immutable asset fails immediately with the exact path', async t => {
  const f = fixture(t, { main: 'a'.repeat(40), assetDenied: true });
  await assert.rejects(run(f.env, false, f.dependencies), /abc\.teajiafinal\.pages\.dev\/assets\/app\.js HTTP 403/);
  assert.equal(f.immutableReads(), 1);
  assert.equal(f.state().state, 'failed');
});
