#!/usr/bin/env node
/**
 * Ratchets worker/tsconfig.json diagnostics. The allowlist lives in
 * scripts/known-worker-ts-errors.txt; a 39th error fails CI even when tsc still
 * exits non-zero for the known 38.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST_PATH = path.join(ROOT, 'scripts/known-worker-ts-errors.txt');
const SIGNATURE = /^worker\/src\/[^:]+:\d+:TS\d+$/;

function tally(lines) {
  const counts = new Map();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

function loadKnown() {
  const lines = readFileSync(LIST_PATH, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const invalid = lines.filter(line => !SIGNATURE.test(line));
  if (invalid.length > 0) {
    console.error('known-worker-ts-errors.txt has invalid signatures:\n' + invalid.join('\n'));
    process.exit(1);
  }
  return tally(lines);
}

function parseDiagnostics(output) {
  const signatures = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^(worker\/src\/[^(]+)\((\d+),\d+\): error (TS\d+):/);
    if (!match) continue;
    signatures.push(`${match[1]}:${match[2]}:${match[3]}`);
  }
  return tally(signatures);
}

function diffCounts(label, expected, actual) {
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  const problems = [];
  for (const key of [...keys].sort()) {
    const want = expected.get(key) ?? 0;
    const got = actual.get(key) ?? 0;
    if (want !== got) problems.push(`  ${key}: expected ${want}, got ${got}`);
  }
  if (problems.length > 0) {
    console.error(`worker typecheck ratchet: ${label}:`);
    for (const line of problems) console.error(line);
    return true;
  }
  return false;
}

const known = loadKnown();
const result = spawnSync('npx', ['tsc', '-p', 'worker/tsconfig.json'], {
  cwd: ROOT,
  encoding: 'utf8',
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const actual = parseDiagnostics(output);
const knownTotal = [...known.values()].reduce((sum, n) => sum + n, 0);
const actualTotal = [...actual.values()].reduce((sum, n) => sum + n, 0);

if (actualTotal === 0 && result.status === 0) {
  if (knownTotal > 0) {
    console.error(`tsc is clean but ${knownTotal} diagnostics remain listed in ${path.relative(ROOT, LIST_PATH)}. Delete them in the same commit.`);
    process.exit(1);
  }
  console.log('worker typecheck: clean');
  process.exit(0);
}

const drift =
  diffCounts('unexpected or missing diagnostics', known, actual) ||
  (actualTotal !== knownTotal && (console.error(`worker typecheck ratchet: expected ${knownTotal} diagnostics, tsc reported ${actualTotal}`), true));

if (drift) process.exit(1);

console.log(`worker typecheck ratchet: ${actualTotal} known errors, no drift`);
process.exit(0);
