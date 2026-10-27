import test from 'node:test';
import assert from 'node:assert/strict';
import { assessUsage, budgetConfig, checkBudget, BUDGET_QUERY, summary } from './check-d1-budget.mjs';

const config = budgetConfig({});
const payload = (...sums) => ({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: sums.map(sum => ({ sum: { readQueries: 1, writeQueries: 1, rowsRead: 0, rowsWritten: 0, ...sum } })) }] } } });
const env = { CLOUDFLARE_API_TOKEN: 'test-secret', CLOUDFLARE_ACCOUNT_ID: 'test-account' };

test('account-wide totals include every returned group and do not filter one database', () => {
  const result = assessUsage(payload({ rowsRead: 2_000_000 }, { rowsRead: 1_500_000 }), config);
  assert.equal(result.rowsRead, 3_500_000);
  assert.equal(result.status, 'warning');
  assert.doesNotMatch(BUDGET_QUERY, /databaseId/);
});
test('threshold boundaries cover reads and writes', () => {
  assert.equal(assessUsage(payload({ rowsRead: 3_499_999 }), config).status, 'ok');
  assert.equal(assessUsage(payload({ rowsRead: 4_500_000 }), config).status, 'critical');
  assert.equal(assessUsage(payload({ rowsWritten: 70_000 }), config).status, 'warning');
  assert.equal(assessUsage(payload({ rowsWritten: 100_001 }), config).status, 'critical');
});
test('missing, malformed, denied and empty metrics never pass as healthy', () => {
  for (const p of [{}, { errors: [{ message: 'denied' }] }, payload(), payload({ rowsRead: null }), payload({ rowsWritten: -1 })]) {
    assert.throws(() => assessUsage(p, config));
  }
  assert.equal(assessUsage(payload({}), config).status, 'ok');
});
test('budget overrides must be positive with ordered thresholds', () => {
  for (const bad of [{ D1_DAILY_READ_BUDGET: '0' }, { D1_DAILY_WRITE_BUDGET: 'nope' }, { D1_WARNING_FRACTION: '0.95' }, { D1_CRITICAL_FRACTION: '1.1' }]) assert.throws(() => budgetConfig(bad));
  assert.equal(budgetConfig({ D1_DAILY_READ_BUDGET: '200' }).reads, 200);
});
test('queries current UTC day through analytics only, with a bounded timeout', async () => {
  const report = await checkBudget({ env, now: new Date('2026-10-26T00:01:00Z'), fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.variables, { accountTag: 'test-account', start: '2026-10-26', end: '2026-10-26' });
    assert.ok(options.signal);
    return { ok: true, json: async () => payload({ rowsRead: 10 }) };
  } });
  assert.equal(report.status, 'ok');
});
test('unavailable monitoring reports unknown without leaking request secrets', async () => {
  for (const fetchImpl of [async () => { throw new Error('test-secret'); }, async () => ({ ok: false, status: 401 }), async () => ({ ok: true, json: async () => ({ errors: [{ message: 'test-secret' }] }) })]) {
    const report = await checkBudget({ env, fetchImpl });
    assert.equal(report.status, 'unknown');
    assert.doesNotMatch(JSON.stringify(report), /test-secret/);
    assert.match(summary(report), /unknown/);
  }
});
test('missing credentials fails without making a request', async () => {
  const report = await checkBudget({ env: {}, fetchImpl: () => assert.fail('must not call') });
  assert.equal(report.status, 'unknown');
});

test('unknown failure still persists JSON and readable report', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { main } = await import('./check-d1-budget.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'd1-budget-test-'));
  try {
    const code = await main({ D1_BUDGET_OUTPUT_DIR: dir });
    assert.equal(code, 3);
    assert.equal(JSON.parse(await readFile(join(dir, 'usage.json'), 'utf8')).status, 'unknown');
    assert.match(await readFile(join(dir, 'usage.md'), 'utf8'), /D1 daily budget: unknown/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
