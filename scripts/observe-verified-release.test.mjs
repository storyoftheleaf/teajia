import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRun, validateProof, publicationDecision, observe, proveLiveWorker, curlWorkerRelease } from './observe-verified-release.mjs';
const candidate = 'a'.repeat(40), expectedMain = 'b'.repeat(40);
const config = { candidate, expectedMain, runId: 123, runAttempt: 1, tag: 'release-test', repo: 'storyoftheleaf/teajia', gitDir: '/tmp/isolated.git', gh: '/opt/homebrew/bin/gh', git: '/opt/homebrew/bin/git' };
const versionId = '12345678-1234-1234-1234-123456789abc';
const proof = { status: 'worker_verified', revision: candidate, versionId };
const run = { id: 123, head_sha: candidate, run_attempt: 1, path: '.github/workflows/deploy-worker.yml', status: 'in_progress', conclusion: null };
const refs = main => `${main}\trefs/heads/main\n${candidate}\trefs/tags/release-test\n`;
test('pins run attempt, artifact identity and unchanged tag/main', () => {
  validateRun(config, run); validateProof(config, proof);
  assert.throws(() => validateRun(config, { ...run, run_attempt: 2 }));
  assert.throws(() => validateRun(config, { ...run, head_sha: expectedMain }));
  assert.throws(() => validateProof(config, { ...proof, revision: expectedMain }));
  assert.equal(publicationDecision(config, refs(expectedMain)), 'push');
  assert.equal(publicationDecision(config, refs(candidate)), 'resume');
  assert.throws(() => publicationDecision(config, refs('c'.repeat(40))));
  assert.throws(() => publicationDecision(config, refs(expectedMain).replace(candidate, expectedMain)));
});
function harness(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'release-observer-'));
  const path = join(dir, 'config.json'); writeFileSync(path, JSON.stringify(config));
  let main = options.main ?? expectedMain, readRuns = 0, pushes = 0;
  const artifact = (name, id) => ({ name, id, expired: false, workflow_run: { id: 123, head_sha: candidate } });
  const commands = [];
  const execute = (binary, args) => {
    commands.push([binary, args]);
    if (binary === config.git) {
      assert.equal(args[0], '--git-dir'); assert.equal(args[1], config.gitDir);
      if (args.includes('ls-remote')) return args.length > 5 ? refs(main) : `${main}\trefs/heads/main\n`;
      if (args.includes('merge-base')) return '';
      if (args.includes('push')) { pushes++; assert.equal(args.at(-1), `${candidate}:refs/heads/main`); assert.ok(!args.includes('--force')); main = candidate; return ''; }
    }
    if (binary === '/usr/bin/unzip') return JSON.stringify(args[1].endsWith('worker-release-proof.zip') ? (options.proof ?? proof) : { state: options.finalState ?? 'live', candidate });
    const endpoint = args[1];
    if (endpoint.endsWith('/123')) {
      readRuns++;
      return JSON.stringify({ ...run, ...(options.run ?? {}), ...(readRuns > 1 ? { status: 'completed', conclusion: 'success' } : {}) });
    }
    if (endpoint.includes('/artifacts?')) return JSON.stringify({ artifacts: [artifact('worker-release-proof', 10), ...(readRuns > 1 ? [artifact('release-result', 11)] : [])] });
    if (endpoint.includes('/jobs?')) return JSON.stringify({ jobs: [{ steps: [{ name: 'Prove exact Worker revision and runtime version', conclusion: options.stepFailure ? 'failure' : 'success' }] }] });
    if (endpoint.endsWith('/zip')) return Buffer.from('mock zip');
    throw new Error(`Unexpected command ${binary} ${args.join(' ')}`);
  };
  return { dir, path, commands, dependencies: { execute, wait: async () => {}, fetch: options.fetch ?? (async () => Response.json(options.live ?? { revision: candidate, versionId })), curlExecute: options.curlExecute }, pushes: () => pushes };
}
const networkFailure = async () => { throw new Error('private error text must not be persisted'); };
test('network fallback uses bounded HTTPS curl and requires the same revision and runtime version', async () => {
  let calls = 0;
  const curlExecute = (binary, args, options) => {
    calls++;
    assert.equal(binary, '/usr/bin/curl');
    assert.equal(args[0], '--disable');
    assert.equal(args[args.indexOf('--proto') + 1], '=https');
    assert.equal(args[args.indexOf('--proto-redir') + 1], '=https');
    assert.equal(args[args.indexOf('--max-time') + 1], '20');
    assert.equal(args[args.indexOf('--connect-timeout') + 1], '8');
    assert.equal(args[args.indexOf('--max-redirs') + 1], '0');
    assert.ok(!args.includes('--location'));
    assert.ok(!args.includes('--insecure'));
    assert.equal(options.timeout, 25000);
    assert.equal(options.maxBuffer, 128 * 1024);
    assert.match(args.at(-1), /^https:\/\/api\.teajia\.com\/api\/release\?proof=/);
    return `${JSON.stringify({ revision: candidate, versionId })}\n200`;
  };
  const h = harness({ fetch: networkFailure, curlExecute });
  try { assert.equal((await observe(h.path, h.dependencies)).status, 'live'); assert.equal(h.pushes(), 1); assert.equal(calls, 1); }
  finally { rmSync(h.dir, { recursive: true, force: true }); }
});
test('curl cannot authorize publication with a wrong SHA, wrong version, redirect or malformed response', async () => {
  for (const output of [
    `${JSON.stringify({ revision: expectedMain, versionId })}\n200`,
    `${JSON.stringify({ revision: candidate, versionId: '87654321-1234-1234-1234-123456789abc' })}\n200`,
    `${JSON.stringify({ revision: candidate, versionId })}\n302`,
    'invalid json\n200',
  ]) {
    const h = harness({ fetch: networkFailure, curlExecute: () => output });
    try { await assert.rejects(observe(h.path, h.dependencies), /No public Worker route matches/); assert.equal(h.pushes(), 0); }
    finally { rmSync(h.dir, { recursive: true, force: true }); }
  }
});
test('curl timeout fails closed with network diagnostics and no raw subprocess error', async () => {
  const h = harness({ fetch: networkFailure, curlExecute: () => { throw new Error('private subprocess error'); } });
  try {
    await assert.rejects(observe(h.path, h.dependencies), /fetch network failure; curl network\/HTTP failure/);
    assert.equal(h.pushes(), 0);
    const state = readFileSync(join(h.dir, 'observer-state.json'), 'utf8');
    assert.ok(!state.includes('private'));
  } finally { rmSync(h.dir, { recursive: true, force: true }); }
});
test('an explicit fetch mismatch stays a mismatch and does not use curl to override it', async () => {
  await assert.rejects(proveLiveWorker(config, proof, {
    fetch: async () => Response.json({ revision: expectedMain, versionId }),
    curlExecute: () => { assert.fail('curl must only be used on a fetch transport failure'); },
  }), /fetch revision\/version mismatch/);
});
test('curl refuses non-success HTTP status even with a valid proof body', () => {
  assert.throws(() => curlWorkerRelease('https://api.teajia.com/api/release', () => `${JSON.stringify(proof)}\n304`), /HTTP response refused/);
});
test('an interrupted fetch body falls back but malformed JSON or HTTP errors do not', async () => {
  const curlExecute = () => `${JSON.stringify({ revision: candidate, versionId })}\n200`;
  assert.equal(await proveLiveWorker(config, proof, {
    fetch: async () => ({ ok: true, json: networkFailure }), curlExecute,
  }), 'https://api.teajia.com');
  for (const response of [new Response('invalid json'), new Response('', { status: 503 })]) {
    await assert.rejects(proveLiveWorker(config, proof, {
      fetch: async () => response.clone(),
      curlExecute: () => { assert.fail('invalid JSON or HTTP failure must not be overridden'); },
    }), /fetch (invalid JSON|HTTP 503)/);
  }
});
test('publishes once after live Worker proof then accepts CI live result', async () => {
  const h = harness();
  try {
    const state = await observe(h.path, h.dependencies);
    assert.equal(state.status, 'live'); assert.equal(h.pushes(), 1);
    assert.equal(state.pid, process.pid); assert.ok(state.resumeCommand.every(item => typeof item === 'string'));
    assert.equal(JSON.parse(readFileSync(join(h.dir, 'observer-state.json'))).candidate, candidate);
    assert.equal(existsSync(join(h.dir, 'observer.lock')), false);
  } finally { rmSync(h.dir, { recursive: true, force: true }); }
});
test('resumes main already at the candidate without another push', async () => {
  const h = harness({ main: candidate });
  try { assert.equal((await observe(h.path, h.dependencies)).status, 'live'); assert.equal(h.pushes(), 0); }
  finally { rmSync(h.dir, { recursive: true, force: true }); }
});
test('failed proof, changed main and terminal workflow failure never publish', async () => {
  for (const options of [{ stepFailure: true }, { main: 'c'.repeat(40) }, { live: { revision: expectedMain, versionId } }, { proof: { ...proof, revision: expectedMain } }, { run: { status: 'completed', conclusion: 'failure' } }]) {
    const h = harness(options);
    try { await assert.rejects(observe(h.path, h.dependencies)); assert.equal(h.pushes(), 0); assert.equal(JSON.parse(readFileSync(join(h.dir, 'observer-state.json'))).status, 'failed'); }
    finally { rmSync(h.dir, { recursive: true, force: true }); }
  }
});
test('a final artifact without proven live state fails instead of claiming shipped', async () => {
  const h = harness({ finalState: 'failed' });
  try { await assert.rejects(observe(h.path, h.dependencies), /Final artifact/); assert.equal(h.pushes(), 1); }
  finally { rmSync(h.dir, { recursive: true, force: true }); }
});
test('active lock refuses a second observer before any external command', async () => {
  const h = harness(); writeFileSync(join(h.dir, 'observer.lock'), String(process.pid));
  try { await assert.rejects(observe(h.path, h.dependencies), /already running/); assert.equal(h.commands.length, 0); }
  finally { rmSync(h.dir, { recursive: true, force: true }); }
});

test('reclaims an orphaned PID lock and resumes without another publication', async () => {
  const h = harness({ main: candidate }); writeFileSync(join(h.dir, 'observer.lock'), '2147483647');
  try {
    const state = await observe(h.path, h.dependencies);
    assert.equal(state.status, 'live'); assert.equal(h.pushes(), 0);
    assert.equal(state.runUrl, 'https://github.com/storyoftheleaf/teajia/actions/runs/123');
    assert.equal(state.statePath, join(h.dir, 'observer-state.json'));
  } finally { rmSync(h.dir, { recursive: true, force: true }); }
});
