#!/usr/bin/env node
/** Local publishing coordination, not a server-side security boundary.
 * Install from a stable copy outside a mutable checkout. This script only reads
 * the lease; its owner creates/removes it and supervises the recorded release.
 */
import { readFile, mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const MAX_LEASE_MS = 45 * 60 * 1000;
export const DEFAULT_LEASE_PATH = join(homedir(), '.codex', 'releases', 'teajia', 'production-lease.json');
const MAIN = 'refs/heads/main';
const HASH = /^[0-9a-f]{40}$/i;
const safeText = value => typeof value === 'string' && value.length > 0 && !/[\x00-\x1f\x7f]/.test(value);

export function isTeajiaRemote(remoteUrl) {
  if (typeof remoteUrl !== 'string') return false;
  let host; let path;
  const scp = remoteUrl.match(/^(?:[^@/:]+@)?([^/:]+):([^/].*)$/);
  if (scp) [, host, path] = scp;
  else {
    try {
      const url = new URL(remoteUrl);
      if (!['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol)) return false;
      host = url.hostname; path = url.pathname.replace(/^\//, '');
    } catch { return false; }
  }
  return host.toLowerCase() === 'github.com'
    && path.replace(/\/$/, '').replace(/\.git$/i, '').toLowerCase() === 'storyoftheleaf/teajia';
}

/** Standard pre-push tuples: local-ref local-oid remote-ref remote-oid. */
export function parsePushUpdates(input) {
  return String(input).split(/\r?\n/).filter(line => line.trim()).map(line => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4 || !HASH.test(fields[1]) || !HASH.test(fields[3])
      || !fields[2].startsWith('refs/')) throw new Error('Malformed Git pre-push input.');
    return { localRef: fields[0], localOid: fields[1].toLowerCase(), remoteRef: fields[2], remoteOid: fields[3].toLowerCase() };
  });
}

export function checkProductionPush({ remoteUrl, input, lease, leaseReadError = false, now = Date.now(), leasePath = DEFAULT_LEASE_PATH }) {
  if (!isTeajiaRemote(remoteUrl)) return { allowed: true, reason: 'other_repository' };
  let updates;
  try { updates = parsePushUpdates(input); }
  catch { return { allowed: false, reason: 'invalid_input', message: 'Cannot validate Git pre-push input. Check the pre-push hook wiring before publishing.' }; }
  const production = updates.filter(update => update.remoteRef === MAIN);
  if (!production.length) return { allowed: true, reason: 'not_main' };
  const repair = `Inspect ${leasePath}. Resume its recorded release or remove the lease only after confirming that publication is no longer active.`;
  if (leaseReadError) return { allowed: false, reason: 'unreadable_lease', message: `Cannot read the production publishing lease. ${repair}` };
  if (lease === undefined) return { allowed: true, reason: 'no_lease' };
  const expiry = lease?.expiresAt ?? lease?.expiresAtISO;
  const expiresAt = typeof expiry === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(expiry) ? Date.parse(expiry) : NaN;
  let validRunUrl = false;
  try {
    const run = new URL(lease?.runUrl);
    validRunUrl = safeText(lease.runUrl) && run.protocol === 'https:' && run.hostname === 'github.com'
      && !run.username && !run.password && /^\/storyoftheleaf\/teajia\/actions(?:\/|$)/.test(run.pathname);
  } catch { /* malformed lease */ }
  const malformed = !lease || typeof lease !== 'object' || !HASH.test(lease.candidate ?? '')
    || /^0{40}$/.test(lease.candidate ?? '')
    || !Number.isFinite(now) || !Number.isFinite(expiresAt) || expiresAt > now + MAX_LEASE_MS
    || !validRunUrl || (lease.resumePath !== undefined && !safeText(lease.resumePath));
  if (malformed) return { allowed: false, reason: 'malformed_lease', message: `The production publishing lease is malformed or exceeds the 45-minute limit. ${repair}` };
  if (expiresAt <= now) return { allowed: true, reason: 'expired_lease' };
  if (production.every(update => update.localOid === lease.candidate.toLowerCase())) return { allowed: true, reason: 'exact_candidate' };
  return {
    allowed: false,
    reason: 'publication_active',
    message: `Production is publishing candidate ${lease.candidate}. Another main push would replace its release proof.\nRun: ${lease.runUrl}\nResume: ${lease.resumePath ?? leasePath}\nLease expires: ${expiry}\nKeep editing or push a branch; resume/finish the recorded release before changing main.`,
  };
}

async function withLeaseLock(path, action) {
  await mkdir(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  let handle;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { handle = await open(lockPath, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (attempt === 39) throw new Error(`Production lease coordination is busy. Inspect ${lockPath}; remove it only after confirming no lease operation is running.`);
      await pause(10);
    }
  }
  try { return await action(); }
  finally { await handle.close(); await rm(lockPath, { force: true }); }
}

async function readLease(path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw new Error(`Cannot read production lease at ${path}.`); }
  try { return JSON.parse(text); }
  catch { throw new Error(`Malformed production lease at ${path}; inspect it before resuming publication.`); }
}

function validLease(lease, path, now) {
  const check = checkProductionPush({
    remoteUrl: 'https://github.com/storyoftheleaf/teajia.git',
    input: `refs/heads/main ${'b'.repeat(40)} refs/heads/main ${'0'.repeat(40)}`,
    lease, now, leasePath: path,
  });
  return check.reason !== 'malformed_lease';
}

/** Claims/renews a local publication lease. The sibling exclusive lock serializes
 * cooperative observers; an atomic rename keeps pre-push readers from seeing a
 * partially written lease. A crashed operation leaves its lock for inspection.
 */
export async function claimProductionLease(path, { candidate, runUrl, resumePath }, now = Date.now()) {
  const lease = { candidate, runUrl, resumePath, expiresAt: new Date(now + MAX_LEASE_MS).toISOString() };
  if (!validLease(lease, path, now)) throw new Error('Invalid production lease claim: require a commit, Teajia Actions URL, safe resume path, and valid clock.');
  lease.candidate = candidate.toLowerCase();
  return withLeaseLock(path, async () => {
    const existing = await readLease(path);
    if (existing !== undefined) {
      if (!validLease(existing, path, now)) throw new Error(`Malformed production lease at ${path}; preserve it and inspect its release state.`);
      const expiry = Date.parse(existing.expiresAt ?? existing.expiresAtISO);
      if (expiry > now && (existing.candidate.toLowerCase() !== lease.candidate || existing.runUrl !== runUrl)) {
        throw new Error(`Another production release owns the lease. Run: ${existing.runUrl}. Resume: ${existing.resumePath ?? path}.`);
      }
    }
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(lease, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
    return lease;
  });
}

/** A finishing observer may only release its own exact candidate AND run. */
export async function releaseProductionLease(path, candidate, runUrl) {
  return withLeaseLock(path, async () => {
    let existing;
    try { existing = await readLease(path); } catch { return false; }
    if (!existing || !validLease(existing, path, Date.now())
      || existing.candidate.toLowerCase() !== String(candidate).toLowerCase() || existing.runUrl !== runUrl) return false;
    await rm(path);
    return true;
  });
}

export async function runCli(args, input) {
  let remoteUrl; let leasePath = DEFAULT_LEASE_PATH;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--remote-url' && args[i + 1]) remoteUrl = args[++i];
    else if (args[i] === '--lease' && args[i + 1]) leasePath = args[++i];
    else throw new Error('Usage: check-production-release-lease.mjs --remote-url URL [--lease PATH] < Git-pre-push-input');
  }
  if (!remoteUrl) throw new Error('The pre-push hook must provide --remote-url "$2".');
  // Branch pushes and unrelated repositories must not depend on lease health.
  const preliminary = checkProductionPush({ remoteUrl, input });
  if (preliminary.reason !== 'no_lease') return preliminary;
  let lease; let leaseReadError = false;
  try {
    const text = await readFile(leasePath, 'utf8');
    try { lease = JSON.parse(text); } catch { lease = null; }
  } catch (error) { if (error.code !== 'ENOENT') leaseReadError = true; }
  return checkProductionPush({ remoteUrl, input, lease, leaseReadError, leasePath });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const result = await runCli(process.argv.slice(2), input);
    if (!result.allowed) { console.error(result.message); process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
