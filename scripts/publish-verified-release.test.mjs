import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  const env = { CANDIDATE_SHA: candidate, EXPECTED_MAIN_SHA: expected, RELEASE_STATE_PATH: join(dir, 'state.json'), WORKER_PROOF_PATH: join(dir, 'worker.json'), PAGES_ARTIFACT_PATH: join(dir, 'pages.json'), CLOUDFLARE_ACCOUNT_ID: 'test', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', TEAJIA_ACCESS_LOGIN_ORIGIN: 'https://soft-band-fe5b.cloudflareaccess.com' };
  writeFileSync(env.WORKER_PROOF_PATH, JSON.stringify({ status: 'worker_verified', revision: candidate, versionId: 'v1' }));
  const digest = value => createHash('sha256').update(value).digest('hex');
  writeFileSync(env.PAGES_ARTIFACT_PATH, JSON.stringify({ revision: options.wrongArtifactSource ? expected : candidate, tree: 'c'.repeat(40), runId: 123, runAttempt: 1, buildId: 42, files: {
    '/index.html': digest('<script src="/assets/app.js"></script>'),
    '/version.json': digest(JSON.stringify({ buildId: 42 })), '/assets/app.js': digest('app bytes'),
  } }));
  let main = options.main || expected;
  let clock = 0;
  let immutableReads = 0;
  let workerReads = 0;
  const workerUrls = [];
  const gitReads = [];
  const mutations = [];
  let projectReads = 0;
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/deployments')) assert.equal(new URL(url).searchParams.get('per_page'), '20');
    if (path.endsWith('/deployments')) return Response.json({ success: true, result: [{ id: 'd1', environment: 'production', deployment_trigger: { metadata: { commit_hash: candidate } }, latest_stage: { status: 'success' }, url: 'https://abc.teajiafinal.pages.dev' }] });
    if (path.includes('/pages/projects/')) {
      projectReads++;
      return Response.json({ success: true, result: { name: 'teajiafinal', production_branch: 'main', domains: ['teajia.com', 'www.teajia.com'], canonical_deployment: {
        id: options.wrongDeployment ? 'other' : 'd1', environment: 'production', url: 'https://abc.teajiafinal.pages.dev',
        latest_stage: { name: 'deploy', status: 'success' }, deployment_trigger: { metadata: { commit_hash: candidate } },
      } } });
    }
    if (path === '/api/release') {
      workerReads++; workerUrls.push(url);
      const response = options.workerResponses?.[Math.min(workerReads - 1, options.workerResponses.length - 1)];
      if (response instanceof Error) throw response;
      if (typeof response === 'number') return new Response('', { status: response });
      return Response.json(response ?? { revision: options.workerRevision || candidate, versionId: 'v1' });
    }
    if (path === '/version.json') {
      if (options.accessProtected && new URL(url).host === 'abc.teajiafinal.pages.dev') {
        assert.equal(init.method, 'HEAD');
        if (options.dnsFailure) throw new TypeError('DNS unavailable');
        return new Response(null, { status: 302, headers: { location: `${options.wrongLogin ? 'https://attacker.example' : 'https://soft-band-fe5b.cloudflareaccess.com'}/cdn-cgi/access/login/abc.teajiafinal.pages.dev?secret=never-persist` } });
      }
      return Response.json({ buildId: 42 });
    }
    if (path === '/') return new Response(options.wrongPublicBytes && new URL(url).host === 'teajia.com' ? '<script src="/assets/other.js"></script>' : '<script src="/assets/app.js"></script>');
    if (new URL(url).host === 'abc.teajiafinal.pages.dev' && path === '/assets/app.js') {
      immutableReads++;
      if (options.assetAlwaysMissing || (options.assetInitiallyMissing && immutableReads === 1)) return new Response('', { status: 404 });
      if (options.assetDenied) return new Response('', { status: 403 });
    }
    return new Response('app bytes');
  };
  const git = (...args) => {
    gitReads.push(args);
    if (args[0] === 'ls-remote') return `${main}\trefs/heads/main`;
    if (args[0] === 'rev-parse') return 'c'.repeat(40);
    if (args[0] === 'merge-base') { if (options.nonAncestor) throw new Error('Expected main is not an ancestor'); return ''; }
    if (args[0] === 'push') { mutations.push(args); main = candidate; return ''; }
    throw new Error(`unexpected git ${args}`);
  };
  return { env, dependencies: { fetch, git, now: () => clock, sleep: async ms => { main = candidate; clock += options.assetAlwaysMissing || options.dnsFailure ? 20 * 60_000 : ms; } }, mutations, gitReads, workerUrls, workerReads: () => workerReads, immutableReads: () => immutableReads, projectReads: () => projectReads, state: () => JSON.parse(readFileSync(env.RELEASE_STATE_PATH, 'utf8')) };
}
test('never advances main for a different live worker', async t => {
  const f = fixture(t, { workerRevision: 'c'.repeat(40) });
  await assert.rejects(run(f.env, false, f.dependencies), /Worker does not match/);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'failed');
  assert.equal(f.workerReads(), 12); assert.equal(f.gitReads.length, 0);
});
test('waits for exact Worker revision AND recorded version with a fresh proof URL on every read', async t => {
  const f = fixture(t, { workerResponses: [
    { revision: 'c'.repeat(40), versionId: 'v1' },
    { revision: 'a'.repeat(40), versionId: 'stale-version' },
    { revision: 'a'.repeat(40), versionId: 'v1' },
  ] });
  await run(f.env, false, f.dependencies);
  assert.equal(f.state().state, 'live');
  assert.equal(f.state().worker.versionId, 'v1');
  assert.equal(f.workerReads(), 4);
  assert.equal(new Set(f.workerUrls).size, 4);
  assert.equal(f.mutations.length, 0);
});
test('retries transient Worker HTTP and transport failures without publication', async t => {
  const f = fixture(t, { workerResponses: [503, new TypeError('network unavailable'), { revision: 'a'.repeat(40), versionId: 'v1' }] });
  await run(f.env, false, f.dependencies);
  assert.equal(f.state().state, 'live'); assert.equal(f.workerReads(), 4); assert.equal(f.mutations.length, 0);
});
test('permanent wrong version or transient failure remains bounded and fails before Git reads', async t => {
  for (const response of [{ revision: 'a'.repeat(40), versionId: 'wrong' }, 503, new TypeError('offline')]) {
    const f = fixture(t, { workerResponses: [response] });
    await assert.rejects(run(f.env, false, f.dependencies), /after bounded propagation reads/);
    assert.equal(f.workerReads(), 12); assert.equal(f.gitReads.length, 0); assert.equal(f.state().state, 'failed');
  }
});
test('a changed final Worker version or revision fails immediately instead of waiting for it to return', async t => {
  for (const final of [{ revision: 'a'.repeat(40), versionId: 'v2' }, { revision: 'c'.repeat(40), versionId: 'v1' }]) {
    const f = fixture(t, { workerResponses: [{ revision: 'a'.repeat(40), versionId: 'v1' }, final] });
    await assert.rejects(run(f.env, false, f.dependencies), /Worker version changed during publication/);
    assert.equal(f.workerReads(), 2); assert.equal(f.state().state, 'failed'); assert.equal(f.mutations.length, 0);
  }
});
test('invalid recorded Worker artifact fails before any public Worker read', async t => {
  const f = fixture(t);
  writeFileSync(f.env.WORKER_PROOF_PATH, JSON.stringify({ status: 'worker_verified', revision: 'c'.repeat(40), versionId: 'v1' }));
  await assert.rejects(run(f.env, false, f.dependencies), /recorded deployment artifact/);
  assert.equal(f.workerReads(), 0); assert.equal(f.gitReads.length, 0);
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
test('protected immutable host uses exact Cloudflare deployment and both public byte graphs', async t => {
  const f = fixture(t, { accessProtected: true });
  await run(f.env, false, f.dependencies);
  assert.equal(f.state().state, 'live');
  assert.equal(f.state().proofMethod, 'canonical-bytes-and-cloudflare-deployment');
  assert.equal(f.state().cloudflareDeployment.id, 'd1');
  assert.equal(f.immutableReads(), 0);
  assert.ok(f.projectReads() >= 3);
  assert.equal(JSON.stringify(f.state()).includes('never-persist'), false);
});
test('protected immutable host refuses incorrect deployment metadata or login origin', async t => {
  for (const option of ['wrongDeployment', 'wrongLogin', 'wrongPublicBytes', 'wrongArtifactSource']) {
    const f = fixture(t, { accessProtected: true, [option]: true });
    await assert.rejects(run(f.env, false, f.dependencies));
    assert.equal(f.state().state, 'failed');
    assert.equal(f.immutableReads(), 0);
  }
});
test('protected immutable host DNS failure cannot become a release proof', async t => {
  const f = fixture(t, { accessProtected: true, dnsFailure: true, main: 'a'.repeat(40) });
  await assert.rejects(run(f.env, false, f.dependencies), /Immutable deployment proof timed out/);
  assert.equal(f.state().state, 'failed');
  assert.equal(f.immutableReads(), 0);
});
test('resumes observation without publishing main again', async t => {
  const f = fixture(t, { main: 'a'.repeat(40) });
  await run(f.env, false, f.dependencies);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'live');
});
test('preflight verifies Pages permissions and exact main ancestry without publishing', async t => {
  const f = fixture(t);
  await run(f.env, 'preflight', f.dependencies);
  assert.equal(f.mutations.length, 0); assert.equal(f.state().state, 'preflight_passed');
  assert.deepEqual(f.gitReads, [
    ['ls-remote', 'origin', 'refs/heads/main'],
    ['merge-base', '--is-ancestor', f.env.EXPECTED_MAIN_SHA, f.env.CANDIDATE_SHA],
  ]);
  assert.equal(f.workerReads(), 0);
});
test('preflight refuses stale or missing remote main before Worker publication', async t => {
  for (const main of ['c'.repeat(40), ' ']) {
    const f = fixture(t, { main });
    await assert.rejects(run(f.env, 'preflight', f.dependencies), /Main changed/);
    assert.equal(f.state().state, 'failed');
    assert.equal(f.gitReads.length, 1);
    assert.equal(f.workerReads(), 0);
    assert.equal(f.mutations.length, 0);
  }
});
test('preflight rejects nonancestor candidates including an already-published resume', async t => {
  for (const main of ['b'.repeat(40), 'a'.repeat(40)]) {
    const f = fixture(t, { main, nonAncestor: true });
    await assert.rejects(run(f.env, 'preflight', f.dependencies), /not an ancestor/);
    assert.equal(f.state().state, 'failed');
    assert.equal(f.workerReads(), 0);
    assert.equal(f.mutations.length, 0);
  }
});
test('preflight accepts a resume with remote main already at the descendant candidate', async t => {
  const f = fixture(t, { main: 'a'.repeat(40) });
  await run(f.env, 'preflight', f.dependencies);
  assert.equal(f.state().state, 'preflight_passed');
  assert.equal(f.gitReads[1][0], 'merge-base');
  assert.equal(f.workerReads(), 0);
  assert.equal(f.mutations.length, 0);
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
