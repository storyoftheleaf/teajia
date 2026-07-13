import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIncidentNotification, notifyI64OS } from './notify-i64os-incidents.mjs';

const incidents = [
  { signature: 'api:503:upstream_not_configured', severity: 'critical', status: 'open' },
  { signature: 'auth:platform_owner_gate', severity: 'high', status: 'acknowledged' },
  { signature: 'old:resolved', severity: 'critical', status: 'resolved' },
];

test('notification contains only compact changed count, severity totals, deployment, and queue path', () => {
  const message = buildIncidentNotification({
    changedCount: 2,
    incidents,
    deployment: 'dc846603',
    repositoryPath: 'ops/incidents/OPEN.md',
  });

  assert.equal(message, [
    '# Teajia incidents ready',
    '',
    '2 changed signatures · Critical: 1 · High: 1 · Medium: 0 · Low: 0',
    'Deployment: `dc846603` · Queue: `ops/incidents/OPEN.md`',
  ].join('\n'));
  assert.ok(message.trim().split(/\s+/).length < 100);
  assert.equal(message.includes('upstream_not_configured'), false);
});

test('notifier is a no-op when endpoint or token is not configured', async () => {
  let calls = 0;
  const result = await notifyI64OS({ message: 'safe', endpoint: '', token: '', fetchImpl: async () => { calls += 1; } });
  assert.deepEqual(result, { sent: false, reason: 'not-configured' });
  assert.equal(calls, 0);
});

test('notifier posts one markdown capture without exposing its credential', async () => {
  const requests = [];
  const result = await notifyI64OS({
    message: '# Teajia incidents ready',
    endpoint: 'https://i64.example/captures',
    token: 'private-token-value',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 202 };
    },
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.headers.authorization, 'Bearer private-token-value');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    source: 'teajia',
    kind: 'system-incident',
    content: '# Teajia incidents ready',
  });
  assert.equal(JSON.stringify(result).includes('private-token-value'), false);
});
