import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPush, decidePush } from './check-worker-push.mjs';

const candidate = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const version = '12345678-1234-1234-1234-123456789abc';
const otherVersion = '87654321-4321-4321-4321-cba987654321';
const origins = ['https://api.teajia.com', 'https://teajia-api.lightcodes.workers.dev'];
const deployment = { id: 'deployment', strategy: 'percentage', versions: [{ percentage: 100, version_id: version }] };
const live = revision => origins.map(origin => ({ origin, revision, versionId: version }));

test('same SHA and same exact version on Cloudflare and both origins skips a duplicate push', () => {
  const result = decidePush({ candidate, deployment, live: live(candidate) });
  assert.equal(result.action, 'skip');
  assert.equal(result.versionId, version);
});

test('a genuinely new Worker revision keeps the normal deploy path', () => {
  assert.equal(decidePush({ candidate, deployment, live: live(previous) }).action, 'deploy');
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
