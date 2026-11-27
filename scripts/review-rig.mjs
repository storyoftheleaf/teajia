#!/usr/bin/env node
/**
 * The review rig (todo/plans/guests-and-tea-masters-review-run.md, O1).
 *
 * Starts one offline fixture worker and one Vite site for one switch state, on
 * ports of its own, so several reviewers can run side by side. Never touches
 * the live shop and never uses port 7777.
 *
 *   node --experimental-sqlite --experimental-strip-types scripts/review-rig.mjs --set all --slot 1
 *   node ... scripts/review-rig.mjs --set live --slot 2 --worker-set all    (half-open: worker open, site closed)
 *
 *   --set <set>         live | all | only:<SWITCH> | upto:<SWITCH> (tests/review/switch-sets.ts)
 *   --slot <n>          0 to 49. Worker on 8900 + 10n, site on 7900 + 10n.
 *   --site-set <set>    the site's switches, if not --set
 *   --worker-set <set>  the worker's switches, if not --set
 *   --keep              reuse the slot's state folder instead of starting fresh
 *
 * Once both answer it prints REVIEW_SITE=... and REVIEW_API=... and writes them
 * to test-results/review/slot-<n>.env. It runs until stopped (Ctrl-C).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteEnv, workerEnv, openSwitches } from '../tests/review/switch-sets.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const worker = join(root, 'worker');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

const set = arg('set', 'live');
const siteSet = arg('site-set', set);
const workerSet = arg('worker-set', set);
const slot = Number(arg('slot', '0'));
if (!Number.isInteger(slot) || slot < 0 || slot > 49) throw new Error('--slot must be a whole number from 0 to 49');
// Validate both sets before starting anything.
openSwitches(siteSet); openSwitches(workerSet);

const apiPort = 8900 + 10 * slot;
const sitePort = 7900 + 10 * slot;
const inspectorPort = apiPort + 1;
const api = `http://127.0.0.1:${apiPort}`;
const site = `http://localhost:${sitePort}`;
const state = join(worker, '.wrangler', 'review', `slot-${slot}`);

if (!process.argv.includes('--keep')) rmSync(state, { recursive: true, force: true });
mkdirSync(state, { recursive: true });

const children = [];
function start(name, cmd, args, opts) {
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `[${name}:${slot}] `;
  child.stdout.on('data', d => process.stdout.write(String(d).replace(/^(?=.)/gm, tag)));
  child.stderr.on('data', d => process.stderr.write(String(d).replace(/^(?=.)/gm, tag)));
  child.on('exit', code => {
    if (!stopping) { console.error(`${tag}exited with ${code}`); stop(code ?? 1); }
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* gone */ } }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

start('api', process.execPath, ['--experimental-sqlite', '--experimental-strip-types', 'sandbox/offline-fixtures.mjs'], {
  cwd: worker,
  env: {
    ...process.env,
    ...workerEnv(workerSet),
    TEAJIA_OFFLINE_FIXTURES_STATE: state,
    TEAJIA_REVIEW_FIXTURES: 'true',
    SANDBOX_PORT: String(apiPort),
    SANDBOX_INSPECTOR_PORT: String(inspectorPort),
  },
});

start('site', join(root, 'node_modules/.bin/vite'), ['--port', String(sitePort), '--strictPort'], {
  cwd: root,
  env: {
    ...process.env,
    ...siteEnv(siteSet),
    VITE_API_URL: api,
    TEAJIA_API_PROXY: api,
  },
});

async function answers(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.status > 0; } catch { return false; }
}

const deadline = Date.now() + 240_000;
while (!(await answers(`${api}/api/public/health`) && await answers(site))) {
  if (stopping) break;
  if (Date.now() > deadline) { console.error('The rig did not answer within four minutes.'); stop(1); break; }
  await new Promise(r => setTimeout(r, 1000));
}
if (!stopping) {
  const lines = [`REVIEW_SITE=${site}`, `REVIEW_API=${api}`, `REVIEW_SITE_SET=${siteSet}`, `REVIEW_WORKER_SET=${workerSet}`];
  mkdirSync(join(root, 'test-results', 'review'), { recursive: true });
  writeFileSync(join(root, 'test-results', 'review', `slot-${slot}.env`), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
