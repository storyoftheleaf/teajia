import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGitAncestry, checkPush, decidePush } from './check-worker-push.mjs';

const candidate = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const version = '12345678-1234-1234-1234-123456789abc';
const otherVersion = '87654321-4321-4321-4321-cba987654321';
const origins = ['https://api.teajia.com', 'https://teajia-api.lightcodes.workers.dev'];
const deployment = { id: '11111111-1111-1111-1111-111111111111', created_on: '2026-11-06T04:10:00Z', strategy: 'percentage', versions: [{ percentage: 100, version_id: version }] };
const live = revision => origins.map(origin => ({ origin, revision, versionId: version }));

test('same SHA and same exact version on Cloudflare and both origins skips a duplicate push', () => {
  const result = decidePush({ candidate, deployment, live: live(candidate) });
  assert.equal(result.action, 'skip');
  assert.equal(result.versionId, version);
});

test('a differing live revision requires Git ancestry before it can deploy', () => {
  assert.equal(decidePush({ candidate, deployment, live: live(previous) }).action, 'check_ancestry');
  const calls = [];
  assertGitAncestry(previous, candidate, (command, args) => {
    calls.push([command, args]);
    return calls.length === 1 ? { status: 0, stdout: `${candidate}\n` } : { status: 0 };
  });
  assert.deepEqual(calls[1], ['git', ['merge-base', '--is-ancestor', previous, candidate]]);
  for (const status of [1, 128]) {
    let count = 0;
    assert.throws(() => assertGitAncestry(previous, candidate, () =>
      ++count === 1 ? { status: 0, stdout: candidate } : { status }), /unknown, newer, or not an ancestor/);
  }
  assert.throws(() => assertGitAncestry(previous, candidate, () => ({ status: 0, stdout: previous })), /checked-out HEAD/);
});

test('unknown, split, or inconsistent live state fails closed', () => {
  const cases = [
    { deployment: { ...deployment, versions: [] }, live: live(candidate) },
    { deployment: { ...deployment, versions: [{ percentage: 50, version_id: version }, { percentage: 50, version_id: otherVersion }] }, live: live(candidate) },
    { deployment, live: [{ ...live(candidate)[0], versionId: otherVersion }, live(candidate)[1]] },
    { deployment, live: [live(candidate)[0], live(previous)[1]] },
    { deployment, live: [live(candidate)[0]] },
    { deployment, live: [{ ...live(candidate)[0], revision: 'unknown' }, live(candidate)[1]] },
  ];
  for (const value of cases) assert.throws(() => decidePush({ candidate, ...value }));
});

test('authenticated Cloudflare read and both cache-busted public reads are required', async () => {
  const seen = [];
  const fetcher = async (url, options) => {
    seen.push({ url: String(url), options });
    if (seen.length === 1) return Response.json({ success: true, result: { deployments: [deployment] } });
    return Response.json({ revision: candidate, versionId: version });
  };
  assert.equal((await checkPush({ candidate, accountId: 'account', token: 'secret', fetcher })).action, 'skip');
  assert.match(seen[0].url, /\/workers\/scripts\/teajia-api\/deployments\?per_page=1$/);
  assert.equal(seen[0].options.headers.Authorization, 'Bearer secret');
  assert.equal(seen.length, 3);
  assert.ok(seen.slice(1).every(item => item.url.includes('/api/release?proof=') && item.options.cache === 'no-store'));
  await assert.rejects(checkPush({ candidate, accountId: 'account', token: 'secret', fetcher: async () => new Response('', { status: 503 }) }));
});

test('a coherent prior revision deploys only after ancestry check succeeds', async () => {
  const fetcher = async url => String(url).includes('api.cloudflare.com')
    ? Response.json({ success: true, result: { deployments: [deployment] } })
    : Response.json({ revision: previous, versionId: version });
  let checked = false;
  const result = await checkPush({ candidate, accountId: 'account', token: 'secret', fetcher,
    checkAncestry: (current, next) => { assert.equal(current, previous); assert.equal(next, candidate); checked = true; } });
  assert.equal(result.action, 'deploy');
  assert.equal(checked, true);
  await assert.rejects(checkPush({ candidate, accountId: 'account', token: 'secret', fetcher,
    checkAncestry: () => { throw new Error('not an ancestor'); } }), /not an ancestor/);
});
