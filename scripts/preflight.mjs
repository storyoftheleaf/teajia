#!/usr/bin/env node
// npm run preflight: the checks CI fails on, run here in about a minute,
// before a push.
//
// Every red PR run on 2026-11-27 was a guard that runs in seconds here: a
// ceiling on raw <button>s, a style-size ceiling, a migration ledger that
// lists every migration. Each one cost a push, a 5 minute wait, a fix and a
// second 5 minute wait. This runs what can fail for the files this branch
// changed, side by side, and the repo-wide guards every time.
//
// It does not replace CI. The full worker suite and the browser specs still
// run there; this only catches what is cheap to catch first.
//
//   npm run preflight            changed since the merge base with origin/main
//   npm run preflight -- --base <ref>

import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

const git = (...a) => execFileSync('git', ['-c', 'core.quotepath=off', ...a], { encoding: 'utf8' }).trim();
// Paths go into shell command lines below: quote each one.
const q = f => `'${String(f).replace(/'/g, `'\\''`)}'`;
const qs = list => list.map(q).join(' ');
const hasRef = ref => { try { git('rev-parse', '--verify', '--quiet', ref); return true; } catch { return false; } };

const upstream = baseArg ?? (hasRef('origin/main') ? 'origin/main' : hasRef('main') ? 'main' : null);
if (!upstream || !hasRef(upstream)) {
  console.error(`preflight: no base to compare with (${baseArg ?? 'origin/main or main'} not found). Run \`git fetch origin main\` or pass --base <ref>.`);
  process.exit(2);
}
const base = git('merge-base', 'HEAD', upstream);
const changed = [...new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean))];

const touches = re => changed.some(f => re.test(f));
const code = touches(/\.(ts|tsx|js|jsx|mjs|css|json)$/);
const worker = touches(/^worker\//);
const platform = touches(/^(\.github\/|scripts\/|package\.json$)/);
const specs = changed.filter(f => /^tests\/.*\.spec\.ts$/.test(f));

// Tests that scan the repo (ceilings, ledgers, "one home" rules) are not
// reached by vitest --changed, because they import no changed file. They
// are exactly the ones that failed, so they always run.
// A test scans the repo when it reads files itself, or imports a helper
// (a *.testkit.ts, a tests/helpers module) that does.
const readsFiles = /readdirSync|readFileSync|readdir\(|globSync|import\.meta\.glob|\?raw['"]|from ['"](node:)?fs['"]/;
const listTests = (dir, re) => existsSync(dir)
  ? readdirSync(dir, { recursive: true }).map(String).filter(f => re.test(f)).map(f => join(dir, f))
  : [];
// Only *.testkit helpers count: nearly every worker test imports a
// tests/helpers module that reads the schema, which would make this the
// whole suite.
const helperNames = ['src', 'functions']
  .flatMap(d => listTests(d, /\.(ts|tsx|mjs)$/))
  .filter(f => /\.testkit\.(ts|tsx|mjs)$/.test(f) && readsFiles.test(readFileSync(f, 'utf8')))
  .map(f => f.split('/').pop().replace(/\.(ts|tsx|mjs)$/, ''));
const helperImport = helperNames.length
  ? new RegExp(`from ['"][^'"]*/(${helperNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(\\.(ts|tsx|mjs))?['"]`)
  : /$^/;
const scansRepo = { test: text => readsFiles.test(text) || helperImport.test(text) };
const haveSqlite = (() => { try { execFileSync('sqlite3', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const needsSqlite = f => /['"]sqlite3['"]/.test(readFileSync(f, 'utf8'));

const srcGuards = [
  ...listTests('src', /\.test\.tsx?$/),
  ...listTests('functions', /\.test\.tsx?$/),
].filter(f => !/\.behavior\.test\./.test(f) && !/(^|\/)\.(claude|worktrees)\//.test(f)
  && scansRepo.test(readFileSync(f, 'utf8')));

const workerScans = /readdirSync|readFileSync|readdir\(|globSync|from ['"](node:)?fs['"]|migratedSqlite|oldShop/;
let workerGuards = worker ? listTests('worker/tests', /\.test\.ts$/).filter(f => workerScans.test(readFileSync(f, 'utf8'))) : [];
const skippedSqlite = haveSqlite ? [] : workerGuards.filter(needsSqlite);
workerGuards = workerGuards.filter(f => !skippedSqlite.includes(f));

const steps = [];
const step = (name, cmd, env = {}) => steps.push({ name, cmd, env });
// `vitest related` with the changed code files, not --changed: --changed
// reruns every test when package.json moves, and a script line is not worth
// the whole suite here (CI runs it anyway).
const codeIn = re => changed.filter(f => re.test(f) && /\.(ts|tsx|js|jsx|mjs)$/.test(f) && existsSync(f));
const srcChanged = codeIn(/^(src|functions|shared)\//);
const workerChanged = codeIn(/^worker\//);
const workerEnv = { NODE_OPTIONS: '--experimental-sqlite' };

if (code) step('Type check', 'npx tsc --noEmit');
step('Color rules', 'bash scripts/lint-colors.sh');
if (srcGuards.length) step('Repo-wide guards (src)', `npx vitest run ${qs(srcGuards)}`);
if (srcChanged.length) step('Unit tests for what changed (src)', `npx vitest related --run ${qs(srcChanged)} --dir . --passWithNoTests --exclude='**/*.behavior.test.ts' --exclude='worker/**' --exclude='tests/**' --exclude='scripts/**' --exclude='**/*.spec.ts' --exclude='**/.claude/worktrees/**' --exclude='**/.worktrees/**'`);
if (worker) {
  step('Worker types (ratcheted)', 'node scripts/worker-typecheck-ratchet.mjs');
  if (workerGuards.length) step('Repo-wide guards (worker)', `npx vitest run ${qs(workerGuards)} --testTimeout=20000`, workerEnv);
  // Not `vitest related`: almost every worker test imports worker/src/index,
  // so related is the whole suite. The tests that import a changed module by
  // name, and the tests that were themselves changed, are the ones that speak
  // to it; the six CI shards run the rest.
  const workerTests = listTests('worker/tests', /\.test\.ts$/);
  const named = workerChanged.filter(f => !/\.test\.ts$/.test(f)).map(f => f.replace(/^worker\//, '').replace(/\.(ts|tsx|js|mjs)$/, ''));
  const direct = workerTests.filter(t => {
    if (changed.includes(t)) return true;
    const text = readFileSync(t, 'utf8');
    return named.some(n => text.includes(`/${n}'`) || text.includes(`/${n}"`) || text.includes(`/${n}.ts'`));
  }).filter(t => !skippedSqlite.includes(t) && !workerGuards.includes(t));
  if (direct.length) step(`Worker tests that import what changed (${direct.length} files)`, `npx vitest run ${qs(direct)} --testTimeout=20000`, workerEnv);
}
if (platform) step('Platform hardening', 'node --test scripts/platform-hardening.test.mjs');

console.log(`preflight: ${changed.length} files changed since ${base.slice(0, 9)} (${upstream}); ${steps.length} checks, side by side\n`);

const run = s => new Promise(resolve => {
  const started = Date.now();
  const child = spawn(s.cmd, { shell: true, env: { ...process.env, ...s.env, FORCE_COLOR: '0' } });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('close', status => {
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`${status === 0 ? 'ok  ' : 'FAIL'} ${s.name} (${secs}s)`);
    resolve({ ...s, status, out });
  });
});

// tsc and the vitest runs each want every core; two at a time finishes
// sooner than all at once on a 4 core machine.
const results = [];
const queue = [...steps];
await Promise.all([0, 1].map(async () => { while (queue.length) results.push(await run(queue.shift())); }));

const failed = results.filter(r => r.status !== 0);
for (const f of failed) {
  console.log(`\n── ${f.name} ──\n$ ${f.cmd.length > 300 ? f.cmd.slice(0, 300) + ' …' : f.cmd}\n`);
  console.log(f.out.split('\n').slice(-60).join('\n'));
}
if (skippedSqlite.length) console.log(`\nLeft to CI: ${skippedSqlite.length} worker test files need the sqlite3 command, which this machine lacks.`);
if (specs.length) console.log(`\nBrowser specs changed; CI runs them. Here: npx playwright test ${qs(specs)}`);
console.log(failed.length ? `\npreflight: ${failed.length} of ${results.length} checks failed. Fix them before pushing.` : `\npreflight: all ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
