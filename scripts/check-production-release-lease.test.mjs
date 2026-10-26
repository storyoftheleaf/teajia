import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isTeajiaRemote, checkProductionPush, runCli, MAX_LEASE_MS, claimProductionLease, releaseProductionLease } from './check-production-release-lease.mjs';

const candidate = 'a'.repeat(40); const other = 'b'.repeat(40); const zero = '0'.repeat(40);
const now = Date.parse('2026-10-26T09:00:00Z');
const remoteUrl = 'git@github.com:storyoftheleaf/teajia.git';
const input = (oid = other, ref = 'refs/heads/main') => `refs/heads/main ${oid} ${ref} ${candidate}\n`;
const lease = { candidate, runUrl: 'https://github.com/storyoftheleaf/teajia/actions/runs/123', expiresAt: new Date(now + 20 * 60_000).toISOString(), resumePath: '/tmp/release-state.json' };
const check = (overrides = {}) => checkProductionPush({ remoteUrl, input: input(), lease, now, ...overrides });

test('recognizes only the intended GitHub repository across Git URL protocols', () => {
  for (const url of [remoteUrl, 'https://github.com/storyoftheleaf/teajia.git', 'ssh://git@github.com/storyoftheleaf/teajia.git', 'ssh://git@github.com:22/storyoftheleaf/teajia', 'git://github.com/storyoftheleaf/teajia', 'https://github.com/StoryOfTheLeaf/Teajia/']) assert.equal(isTeajiaRemote(url), true, url);
  for (const url of ['git@github.com:other/teajia.git', 'https://github.com.evil.test/storyoftheleaf/teajia', '/tmp/teajia', 'https://example.com/storyoftheleaf/teajia', 'https://github.com/storyoftheleaf/teajia-extra']) assert.equal(isTeajiaRemote(url), false, url);
});

test('blocks other main candidates and deletions, permits only the exact leased candidate', () => {
  const blocked = check(); assert.equal(blocked.allowed, false); assert.match(blocked.message, /actions\/runs\/123/); assert.match(blocked.message, /Resume: \/tmp\/release-state.json/);
  assert.equal(check({ input: input(candidate) }).allowed, true);
  assert.equal(check({ input: input(zero).replace('refs/heads/main', '(delete)') }).allowed, false);
  assert.equal(check({ input: input(candidate) + input(other) }).allowed, false);
});

test('never blocks branch pushes or other repositories because a lease is broken', () => {
  assert.equal(check({ input: input(other, 'refs/heads/codex/work'), lease: null, leaseReadError: true }).allowed, true);
  assert.equal(check({ remoteUrl: 'git@github.com:other/repo.git', input: 'not Git input', lease: null }).allowed, true);
  assert.equal(check({ input: '' }).allowed, true);
});

test('permits absent and expired leases, rejects malformed or overlong leases', () => {
  assert.equal(check({ lease: undefined }).allowed, true);
  assert.equal(check({ lease: { ...lease, expiresAt: new Date(now).toISOString() } }).allowed, true);
  for (const broken of [null, {}, { ...lease, candidate: 'bad' }, { ...lease, candidate: zero }, { ...lease, expiresAt: 'tomorrow' }, { ...lease, expiresAt: new Date(now + MAX_LEASE_MS + 1).toISOString() }, { ...lease, runUrl: 'javascript:bad' }, { ...lease, resumePath: 'bad\npath' }]) {
    assert.equal(check({ lease: broken }).reason, 'malformed_lease');
  }
  assert.equal(check({ leaseReadError: true }).reason, 'unreadable_lease');
  const { expiresAt, ...rest } = lease;
  assert.equal(check({ lease: { ...rest, expiresAtISO: expiresAt }, input: input(candidate) }).allowed, true);
});

test('fails closed on malformed Git tuples without leaking remote credentials', () => {
  const result = check({ remoteUrl: 'https://token:secret@github.com/storyoftheleaf/teajia.git', input: 'bad main push' });
  assert.equal(result.reason, 'invalid_input'); assert.doesNotMatch(result.message, /secret|token/);
});

test('CLI reads leases without mutating them and ignores broken files for branch pushes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teajia-lease-test-')); const path = join(directory, 'lease.json');
  const args = ['--remote-url', remoteUrl, '--lease', path];
  try {
    assert.equal((await runCli(args, input())).reason, 'no_lease');
    await writeFile(path, '{broken');
    assert.equal((await runCli(args, input())).reason, 'malformed_lease');
    assert.equal((await runCli(args, input(other, 'refs/heads/codex/build'))).allowed, true);
    await writeFile(path, JSON.stringify({ ...lease, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    assert.equal((await runCli(args, input())).reason, 'publication_active');
    assert.equal((await runCli(args, input(candidate))).allowed, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function lifecycleFixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'teajia-lease-lifecycle-'));
  try { await fn(join(directory, 'production-lease.json')); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('claim creates, matching owner renews, and mismatched candidate OR run preserves the active lease', async () => lifecycleFixture(async path => {
  const at = Date.now(); const owner = { candidate, runUrl: lease.runUrl, resumePath: lease.resumePath };
  const first = await claimProductionLease(path, owner, at);
  assert.equal(Date.parse(first.expiresAt), at + MAX_LEASE_MS);
  const renewed = await claimProductionLease(path, owner, at + 1000);
  assert.equal(Date.parse(renewed.expiresAt), at + 1000 + MAX_LEASE_MS);
  for (const conflict of [{ ...owner, candidate: other }, { ...owner, runUrl: owner.runUrl + '4' }]) {
    await assert.rejects(claimProductionLease(path, conflict, at + 1000), /Another production release owns/);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), renewed);
  }
}));

test('expired leases can be replaced but malformed leases and failed claims remain untouched', async () => lifecycleFixture(async path => {
  const at = Date.now();
  await writeFile(path, JSON.stringify({ ...lease, expiresAt: new Date(at - 1).toISOString() }));
  const claimed = await claimProductionLease(path, { candidate: other, runUrl: lease.runUrl, resumePath: lease.resumePath }, at);
  assert.equal(claimed.candidate, other);
  await writeFile(path, '{broken');
  await assert.rejects(claimProductionLease(path, lease, at), /Malformed production lease/);
  assert.equal(await readFile(path, 'utf8'), '{broken');
  assert.equal(await releaseProductionLease(path, candidate, lease.runUrl), false);
  assert.equal(await readFile(path, 'utf8'), '{broken');
}));

test('release removes only matching candidate and run, including repeated cleanup', async () => lifecycleFixture(async path => {
  await claimProductionLease(path, lease);
  assert.equal(await releaseProductionLease(path, other, lease.runUrl), false);
  assert.equal(await releaseProductionLease(path, candidate, lease.runUrl + '4'), false);
  assert.equal(await releaseProductionLease(path, candidate, lease.runUrl), true);
  assert.equal(await releaseProductionLease(path, candidate, lease.runUrl), false);
}));

test('concurrent different owners cannot both claim a missing lease', async () => lifecycleFixture(async path => {
  const claims = await Promise.allSettled([
    claimProductionLease(path, { ...lease, candidate }),
    claimProductionLease(path, { ...lease, candidate: other }),
  ]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(claims.filter(result => result.status === 'rejected').length, 1);
  const actual = JSON.parse(await readFile(path, 'utf8'));
  const winner = claims.find(result => result.status === 'fulfilled').value;
  assert.equal(actual.candidate, winner.candidate);
}));

test('a crash lock fails clearly without overwriting an active lease', async () => lifecycleFixture(async path => {
  await claimProductionLease(path, lease);
  const before = await readFile(path, 'utf8');
  await writeFile(`${path}.lock`, 'another operation');
  await assert.rejects(claimProductionLease(path, lease), /coordination is busy/);
  assert.equal(await readFile(path, 'utf8'), before);
  assert.equal(await readFile(`${path}.lock`, 'utf8'), 'another operation');
}));
