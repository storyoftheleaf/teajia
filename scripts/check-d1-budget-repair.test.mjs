import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { emptyRepairState, planRepair, deliverRepair, handoffBudgetRepair, readRepairState, REPAIR_ENDPOINT } from './check-d1-budget-repair.mjs';

const secret = 'never-print-this-secret';
const accountId = 'test-account';
const report = (status, hour = 1) => ({ status, checkedAt: `2026-10-26T${String(hour).padStart(2, '0')}:00:00.000Z`, utcDay: '2026-10-26', rowsRead: 4_600_000, rowsWritten: 123, budgets: { reads: 5_000_000, writes: 100_000 } });
const accepted = () => ({ status: 202, json: async () => ({ ok: true, data: { accepted: true } }) });
const silentSleep = async () => {};
async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'd1-repair-'));
  try { await fn(join(dir, 'state.json')); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('new warning, critical escalation, and unknown have bounded receiver-compatible evidence', () => {
  for (const [status, severity] of [['warning', 'medium'], ['critical', 'critical'], ['unknown', 'high']]) {
    const plan = planRepair(report(status), emptyRepairState(), accountId, 'https://github.com/storyoftheleaf/teajia/actions/runs/123');
    const i = plan.incident.incident;
    assert.equal(plan.incident.source, 'teajia');
    assert.equal(plan.incident.repo, 'storyoftheleaf/teajia');
    assert.equal(i.severity, severity);
    assert.match(i.id, /^[A-Za-z0-9_-]{1,64}$/);
    assert.ok(i.safe_message.length <= 500);
    assert.equal(JSON.parse(i.change).transition, 'new');
    assert.match(i.change, /has no Teajia D1 ledger row/);
    assert.match(i.change, /actions\/runs\/123/);
  }
});

test('accepted repeats deduplicate across runs, escalation sends once and downgrade stays quiet', async () => fixture(async stateFile => {
  const bodies = [];
  const fetchImpl = async (url, opts) => { assert.equal(url, REPAIR_ENDPOINT); bodies.push(JSON.parse(opts.body)); return accepted(); };
  const opts = { stateFile, accountId, secret, fetchImpl, sleep: silentSleep };
  assert.equal((await handoffBudgetRepair(report('warning'), opts)).status, 'accepted');
  assert.equal((await handoffBudgetRepair(report('warning', 2), opts)).status, 'deduplicated');
  assert.equal((await handoffBudgetRepair(report('critical', 3), opts)).status, 'accepted');
  assert.equal(JSON.parse(bodies[1].incident.change).transition, 'escalated');
  assert.equal((await handoffBudgetRepair(report('critical', 4), opts)).status, 'deduplicated');
  assert.equal((await handoffBudgetRepair(report('warning', 5), opts)).status, 'deduplicated');
  assert.equal(bodies.length, 2);
  assert.notEqual(bodies[0].incident.signature, bodies[1].incident.signature);
}));

test('recovery rearms locally but preserves receiver seven-day signature gate', async () => fixture(async stateFile => {
  const bodies = [];
  const opts = { stateFile, accountId, secret, sleep: silentSleep, fetchImpl: async (_, options) => { bodies.push(JSON.parse(options.body)); return accepted(); } };
  await handoffBudgetRepair(report('critical'), opts);
  assert.equal((await handoffBudgetRepair(report('ok', 2), opts)).status, 'not_needed');
  assert.equal((await readRepairState(stateFile)).episodes.quota.active, false);
  assert.equal((await handoffBudgetRepair(report('critical', 3), opts)).status, 'accepted');
  assert.equal(JSON.parse(bodies[1].incident.change).transition, 'reopened');
  assert.equal(bodies[0].incident.signature, bodies[1].incident.signature);
  assert.equal(bodies.length, 2); // No invented recovery/clear receiver route.
}));

test('unknown telemetry never clears an active quota episode', async () => fixture(async stateFile => {
  const opts = { stateFile, accountId, secret, fetchImpl: async () => accepted(), sleep: silentSleep };
  await handoffBudgetRepair(report('critical'), opts);
  await handoffBudgetRepair(report('unknown', 2), opts);
  let state = await readRepairState(stateFile);
  assert.equal(state.episodes.quota.active, true);
  assert.equal(state.episodes.telemetry.active, true);
  assert.equal((await handoffBudgetRepair(report('critical', 3), opts)).status, 'deduplicated');
  state = await readRepairState(stateFile);
  assert.equal(state.episodes.telemetry.active, false);
}));

test('bounded retries reuse identical payload and persist intent before network', async () => fixture(async stateFile => {
  let calls = 0;
  const bodies = [];
  const result = await handoffBudgetRepair(report('critical'), { stateFile, accountId, secret, sleep: silentSleep, fetchImpl: async (_, options) => {
    assert.ok((await readRepairState(stateFile)).episodes.quota.active);
    assert.equal(options.headers['x-i64os-repair-secret'], secret);
    assert.equal(options.headers['User-Agent'], 'teajia-d1-budget/1.0');
    assert.equal(options.redirect, 'error');
    bodies.push(options.body);
    calls += 1;
    return calls === 3 ? accepted() : { status: 503 };
  } });
  assert.equal(result.status, 'accepted');
  assert.equal(calls, 3);
  assert.equal(new Set(bodies).size, 1);
  assert.doesNotMatch(await readFile(stateFile, 'utf8'), new RegExp(secret));
}));

test('failed or ambiguous delivery remains retryable next run with stable identity', async () => fixture(async stateFile => {
  const bodies = [];
  const opts = { stateFile, accountId, secret, sleep: silentSleep, fetchImpl: async (_, options) => { bodies.push(JSON.parse(options.body)); throw new Error(secret); } };
  const failed = await handoffBudgetRepair(report('unknown'), opts);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempts, 3);
  assert.doesNotMatch(JSON.stringify(failed), new RegExp(secret));
  assert.deepEqual((await readRepairState(stateFile)).episodes.telemetry.accepted, []);
  const result = await handoffBudgetRepair(report('unknown', 2), { ...opts, fetchImpl: async (_, options) => { bodies.push(JSON.parse(options.body)); return accepted(); } });
  assert.equal(result.status, 'accepted');
  assert.equal(bodies[0].incident.signature, bodies.at(-1).incident.signature);
}));

test('missing secret and auth rejection are explicit failures, not acceptance', async () => fixture(async stateFile => {
  assert.equal((await handoffBudgetRepair(report('ok'), { stateFile, accountId, fetchImpl: () => assert.fail('no request') })).status, 'failed');
  let calls = 0;
  const body = planRepair(report('critical'), emptyRepairState(), accountId).incident;
  const result = await deliverRepair(body, secret, { fetchImpl: async () => { calls++; return { status: 401 }; }, sleep: silentSleep });
  assert.equal(result.status, 'failed');
  assert.equal(calls, 1);
  const badReceipt = await deliverRepair(body, secret, { fetchImpl: async () => ({ status: 202, json: async () => ({ token: secret }) }), sleep: silentSleep });
  assert.equal(badReceipt.status, 'failed');
  assert.doesNotMatch(JSON.stringify(badReceipt), new RegExp(secret));
}));

test('corrupt persisted state fails closed rather than dispatching anew', async () => fixture(async stateFile => {
  await writeFile(stateFile, '{broken');
  await assert.rejects(handoffBudgetRepair(report('critical'), { stateFile, accountId, secret, fetchImpl: () => assert.fail('no dispatch') }), /state could not be read/);
}));

test('workflow serializes restore/send/save across production triggers and persists failures', async () => {
  const workflow = await readFile(new URL('../.github/workflows/d1-budget.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github\.event_name == 'pull_request' && github\.ref \|\| 'production'/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /I64OS_REPAIR_SECRET: \$\{\{ secrets\.I64OS_REPAIR_SECRET \}\}/);
  assert.match(workflow, /name: Persist repair state[\s\S]*?if: always\(\)/);
  assert.match(workflow, /retention-days: 90/);
});

test('CLI persists usage plus explicit failed handoff and returns failure', async () => fixture(async stateFile => {
  const { main } = await import('./check-d1-budget.mjs');
  const { dirname } = await import('node:path');
  const directory = dirname(stateFile);
  // Missing analytics token produces an unknown reading without external IO;
  // missing repair secret must remain a separate visible delivery failure.
  const code = await main({ I64OS_REPAIR_READY: 'true', CLOUDFLARE_ACCOUNT_ID: accountId, D1_REPAIR_STATE_FILE: stateFile, D1_BUDGET_OUTPUT_DIR: directory });
  assert.equal(code, 4);
  const artifact = JSON.parse(await readFile(join(directory, 'usage.json'), 'utf8'));
  assert.equal(artifact.status, 'unknown');
  assert.equal(artifact.repair.status, 'failed');
  assert.match(artifact.repair.reason, /I64OS_REPAIR_SECRET/);
  assert.deepEqual((await readRepairState(stateFile)).episodes.telemetry.accepted, []);
}));


test('unverified executor persists intent and fails visibly without sending an incident', async () => fixture(async stateFile => {
  const { main } = await import('./check-d1-budget.mjs');
  const { dirname } = await import('node:path');
  const directory = dirname(stateFile);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('unready executor must not send');
  try {
    const code = await main({ CLOUDFLARE_ACCOUNT_ID: accountId, I64OS_REPAIR_SECRET: secret,
      I64OS_REPAIR_READY: 'false', D1_REPAIR_STATE_FILE: stateFile, D1_BUDGET_OUTPUT_DIR: directory });
    assert.equal(code, 4);
    const artifact = JSON.parse(await readFile(join(directory, 'usage.json'), 'utf8'));
    assert.equal(artifact.repair.status, 'failed');
    assert.match(artifact.repair.reason, /network sign-in and service SSH credential/);
    assert.deepEqual((await readRepairState(stateFile)).episodes.telemetry.accepted, []);
    assert.doesNotMatch(JSON.stringify(artifact), new RegExp(secret));
  } finally { globalThis.fetch = originalFetch; }
}));
