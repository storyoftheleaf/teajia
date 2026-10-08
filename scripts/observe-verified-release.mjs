#!/usr/bin/env node
/** Durable local observer: one normal Git publication after CI's live Worker proof. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { dirname, join, isAbsolute, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
const SHA = /^[a-f0-9]{40}$/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const PROOF_STEP = 'Prove exact Worker revision and runtime version';
const WORKER_ORIGINS = ['https://api.teajia.com', 'https://teajia.com', 'https://www.teajia.com', 'https://teajia-api.lightcodes.workers.dev'];

export function curlWorkerRelease(url, run = execFileSync) {
  // Disable curlrc, redirects and non-HTTPS protocols. No authentication is sent.
  const output = run('/usr/bin/curl', ['--disable', '--silent', '--show-error', '--fail',
    '--proto', '=https', '--proto-redir', '=https', '--max-redirs', '0',
    '--connect-timeout', '8', '--max-time', '20', '--max-filesize', '65536',
    '--header', 'Cache-Control: no-cache', '--write-out', '\n%{http_code}', url],
  { encoding: 'utf8', timeout: 25000, maxBuffer: 128 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const split = output.lastIndexOf('\n');
  const status = output.slice(split + 1);
  if (!/^2\d\d$/.test(status)) throw new Error('curl HTTP response refused');
  return JSON.parse(output.slice(0, split));
}

export async function proveLiveWorker(config, proof, dependencies = {}) {
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  const diagnostics = [];
  for (const origin of WORKER_ORIGINS) {
    const url = `${origin}/api/release?proof=${config.candidate}-${now()}`;
    let live;
    let transport = 'fetch';
    try {
      const response = await fetcher(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) { diagnostics.push(`${origin}: fetch HTTP ${response.status}`); continue; }
      live = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) { diagnostics.push(`${origin}: fetch invalid JSON`); continue; }
      transport = 'curl';
      try { live = curlWorkerRelease(url, dependencies.curlExecute); }
      catch (error) {
        // Never persist raw stderr, response bodies or credentials in diagnostics.
        const reason = error instanceof SyntaxError ? 'invalid JSON' : error.message === 'curl HTTP response refused' ? 'HTTP refused' : 'network/HTTP failure';
        diagnostics.push(`${origin}: fetch network failure; curl ${reason}`);
        continue;
      }
    }
    if (live?.revision === config.candidate && live.versionId === proof.versionId) return origin;
    diagnostics.push(`${origin}: ${transport} revision/version mismatch`);
  }
  throw new Error(`No public Worker route matches candidate and artifact version (${diagnostics.join('; ')})`);
}

export function validateConfig(config) {
  if (!SHA.test(config.candidate) || !SHA.test(config.expectedMain)) throw new Error('Full candidate and expected-main SHAs required');
  if (config.repo !== 'storyoftheleaf/teajia' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(config.tag) || config.tag.includes('..')) throw new Error('Invalid repository/tag');
  if (!Number.isSafeInteger(config.runId) || config.runId < 1 || config.runAttempt !== 1) throw new Error('Exact run ID and attempt 1 required');
  for (const field of ['gitDir', 'gh', 'git']) if (!isAbsolute(config[field] ?? '')) throw new Error(`${field} must be absolute`);
}
export function validateRun(config, run) {
  if (run.head_sha !== config.candidate || run.run_attempt !== config.runAttempt || run.id !== config.runId) throw new Error('CI run identity differs from the pinned candidate/attempt');
  if (!run.path?.startsWith('.github/workflows/deploy-worker.yml')) throw new Error('Unexpected deployment workflow');
}
export function validateProof(config, proof) {
  if (proof.status !== 'worker_verified' || proof.revision !== config.candidate || !/^[a-f0-9-]{36}$/i.test(proof.versionId ?? '')) throw new Error('Worker artifact does not prove the candidate revision/version');
  return proof;
}
export function publicationDecision(config, refs) {
  const rows = new Map(refs.trim().split('\n').filter(Boolean).map(line => { const [sha, ref] = line.split(/\s+/); return [ref, sha]; }));
  const tagged = rows.get(`refs/tags/${config.tag}^{}`) ?? rows.get(`refs/tags/${config.tag}`);
  if (tagged !== config.candidate) throw new Error('Immutable candidate tag changed or is missing');
  const main = rows.get('refs/heads/main');
  if (main === config.candidate) return 'resume';
  if (main !== config.expectedMain) throw new Error('Main changed; publication stopped for integration');
  return 'push';
}
function execute(binary, args, encoding = 'utf8') {
  try { return execFileSync(binary, args, { encoding, timeout: 60000, maxBuffer: 5 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { throw new Error(`${basename(binary)} command failed (status ${error.status ?? 'timeout'})`); }
}
function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
function claimLock(path) {
  try {
    const fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, String(process.pid)); closeSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(readFileSync(path, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Observer lock is unreadable; inspect it before resuming');
    try { process.kill(pid, 0); throw new Error('Release observer is already running'); }
    catch (failure) { if (failure.code !== 'ESRCH') throw failure; }
    unlinkSync(path);
    claimLock(path);
  }
}
export async function observe(configPath, dependencies = {}) {
  if (!isAbsolute(configPath)) throw new Error('Absolute config path required');
  const config = JSON.parse(readFileSync(configPath, 'utf8')); validateConfig(config);
  const stateDir = dirname(configPath); mkdirSync(stateDir, { recursive: true });
  const lock = join(stateDir, 'observer.lock'); claimLock(lock);
  const statePath = join(stateDir, 'observer-state.json');
  const command = dependencies.execute ?? execute;
  const wait = dependencies.wait ?? delay;
  const now = dependencies.now ?? Date.now;
  let prior = {};
  try { prior = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* first start */ }
  let state = { ...prior, candidate: config.candidate, expectedMain: config.expectedMain, tag: config.tag, runId: config.runId, runAttempt: config.runAttempt,
    runUrl: `https://github.com/${config.repo}/actions/runs/${config.runId}`, statePath,
    pid: process.pid, startedAt: new Date().toISOString(), resumeCommand: [process.execPath, new URL(import.meta.url).pathname, '--config', configPath] };
  const persist = (status, extra = {}) => { state = { ...state, ...extra, status, updatedAt: new Date().toISOString() }; atomicJson(statePath, state); };
  const api = suffix => JSON.parse(command(config.gh, ['api', `repos/${config.repo}/${suffix}`]));
  const git = (...args) => command(config.git, ['--git-dir', config.gitDir, ...args]).trim();
  const artifact = (artifacts, name) => {
    const matches = artifacts.filter(item => item.name === name && !item.expired);
    if (matches.length !== 1) throw new Error(`Expected one unexpired ${name} artifact`);
    const item = matches[0];
    if (item.workflow_run?.id !== config.runId || item.workflow_run?.head_sha !== config.candidate) throw new Error('Artifact run/revision identity differs from candidate');
    const zip = join(stateDir, `${name}.zip`);
    writeFileSync(zip, command(config.gh, ['api', `repos/${config.repo}/actions/artifacts/${item.id}/zip`], null), { mode: 0o600 });
    return JSON.parse(command('/usr/bin/unzip', ['-p', zip, name === 'worker-release-proof' ? 'worker-release-proof.json' : 'release-state.json']));
  };
  try {
    persist('started');
    const deadline = now() + 40 * 60 * 1000;
    let published = false;
    while (now() < deadline) {
      const run = api(`actions/runs/${config.runId}`); validateRun(config, run);
      if (run.status === 'completed' && run.conclusion !== 'success') throw new Error(`Deployment workflow ended ${run.conclusion}`);
      const artifacts = api(`actions/runs/${config.runId}/artifacts?per_page=100`).artifacts;
      if (!published && artifacts.some(item => item.name === 'worker-release-proof' && !item.expired)) {
        const jobs = api(`actions/runs/${config.runId}/attempts/${config.runAttempt}/jobs?per_page=100`).jobs;
        if (!jobs.some(job => job.steps?.some(step => step.name === PROOF_STEP && step.conclusion === 'success'))) throw new Error('Worker proof step did not succeed in the pinned run attempt');
        const proof = validateProof(config, artifact(artifacts, 'worker-release-proof'));
        const liveOrigin = await proveLiveWorker(config, proof, dependencies);
        const refs = git('ls-remote', 'origin', 'refs/heads/main', `refs/tags/${config.tag}`, `refs/tags/${config.tag}^{}`);
        const decision = publicationDecision(config, refs);
        persist('worker_verified', { workerProof: proof, liveOrigin });
        if (decision === 'push') {
          git('merge-base', '--is-ancestor', config.expectedMain, config.candidate);
          git('push', 'origin', `${config.candidate}:refs/heads/main`);
        }
        const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
        if (remote !== config.candidate) throw new Error('Published main does not match the candidate');
        published = true; persist('pages_pending');
      }
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') throw new Error(`Deployment workflow ended ${run.conclusion}`);
        const result = artifact(artifacts, 'release-result');
        if (!published || result.state !== 'live' || result.candidate !== config.candidate) throw new Error('Final artifact does not prove this candidate live');
        persist('live', { result, completedAt: new Date().toISOString() }); return state;
      }
      await wait(15000);
    }
    throw new Error('Observation timed out; resume the same candidate/run without redeploying');
  } catch (error) { persist('failed', { error: error.message }); throw error; }
  finally { try { unlinkSync(lock); } catch { /* already removed */ } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf('--config');
  if (index < 0 || !process.argv[index + 1]) throw new Error('--config ABSOLUTE_PATH required');
  await observe(process.argv[index + 1]);
}
