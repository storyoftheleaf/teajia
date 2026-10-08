import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRun, validateProof, publicationDecision, observe } from './observe-verified-release.mjs';
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
  return { dir, path, commands, dependencies: { execute, wait: async () => {}, fetch: async () => Response.json(options.live ?? { revision: candidate, versionId }) }, pushes: () => pushes };
}
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
