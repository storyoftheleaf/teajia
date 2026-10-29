import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { expireArBridgeRequests, handleArBridge, readTeaArExcerpt } from '../src/curateArBridge';

let db: SqliteD1;
const scope = { accountId: 'account-a', userId: 'user-a' };
const other = { accountId: 'account-b', userId: 'user-b' };
const call = (action: string, options: { method?: string; body?: unknown; scope?: typeof scope; id?: string; secret?: string; token?: string; query?: string } = {}) => handleArBridge(new Request(`https://teajia.test/api/curate/ar-create/${action}${options.query ?? ''}`, { method: options.method ?? (options.body ? 'POST' : 'GET'), headers: { ...(options.token || options.secret ? { Authorization: `Bearer ${options.token ?? options.secret}` } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }), { DB: db as unknown as D1Database }, options.scope, action, options.id);
async function pair(account = scope) {
  const response = await call('pair/start', { method: 'POST' });
  expect(response.status).toBe(201);
  const start = await response.json() as any;
  expect((await call('pair/claim', { scope: account, body: { code: start.code } })).status).toBe(200);
  const exchanged = await call('pair/status', { id: start.deviceId, secret: start.deviceSecret });
  const paired = await exchanged.json() as any;
  expect(paired.status).toBe('paired');
  return { ...start, token: paired.token };
}
async function job(token: string, kind: 'search' | 'read' = 'read', account = scope) {
  const response = await call('requests', { scope: account, body: kind === 'read' ? { kind, sourceId: 'source-1' } : { kind, query: 'Yiwu' } });
  const requested = await response.json() as any;
  const poll = await call('connector/poll', { token, method: 'POST' });
  const { jobs } = await poll.json() as any;
  expect(jobs[0].id).toBe(requested.id);
  return requested;
}
const source = { id: 'source-1', title: 'Yiwu field notes', hash: 'sha256:source-hash', text: 'First line.\nA spring harvest from Yiwu.\nLast line.' };
const result = { source };

beforeEach(() => {
  db = new SqliteD1(false);
  db.sqlite.exec('CREATE TABLE tea_compass_entries (id TEXT PRIMARY KEY, account_id TEXT NOT NULL)');
  db.sqlite.exec(readFileSync(new URL('../migrations/0045_curate_ar_bridge.sql', import.meta.url), 'utf8'));
  db.sqlite.exec(readFileSync(new URL('../migrations/0046_curate_ar_full_transcripts.sql', import.meta.url), 'utf8'));
  db.sqlite.exec(readFileSync(new URL('../migrations/0051_curate_ar_poll_read_indexes.sql', import.meta.url), 'utf8'));
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id) VALUES (?,?)').run('tea-a', scope.accountId);
  db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id) VALUES (?,?)').run('tea-b', other.accountId);
});
afterEach(() => { vi.restoreAllMocks(); db.close(); });

describe('local AR connector pairing', () => {
  it('keeps secrets hashed, requires the secret for exchange, and retries the same paired token safely', async () => {
    const paired = await pair();
    const row = db.sqlite.prepare('SELECT * FROM curate_ar_devices WHERE id=?').get(paired.deviceId) as any;
    expect(JSON.stringify(row)).not.toContain(paired.deviceSecret);
    expect(JSON.stringify(row)).not.toContain(paired.token);
    expect((await call('pair/status', { id: paired.deviceId, secret: 'wrong-secret' })).status).toBe(401);
    expect((await call('pair/status', { id: paired.deviceId, query: '?secret=' + encodeURIComponent(paired.deviceSecret) })).status).toBe(401);
    expect(await (await call('pair/status', { id: paired.deviceId, secret: paired.deviceSecret })).json()).toMatchObject({ status: 'paired', token: paired.token });
    expect((await call('pair/claim', { scope: other, body: { code: paired.code } })).status).toBe(409);
    expect((await call('status')).status).toBe(401);
  });
  it('expires unclaimed pair codes and refuses a late token exchange', async () => {
    const start = await (await call('pair/start', { method: 'POST' })).json() as any;
    db.sqlite.prepare('UPDATE curate_ar_devices SET pair_expires_at=? WHERE id=?').run(Date.now() - 1, start.deviceId);
    expect((await call('pair/claim', { scope, body: { code: start.code } })).status).toBe(410);
    expect((await call('pair/status', { id: start.deviceId, secret: start.deviceSecret })).status).toBe(410);
  });
  it('replaces the one account connector, revokes its token and permits disconnect without touching another shop', async () => {
    const first = await pair();
    const foreign = await pair(other);
    const second = await pair();
    expect((await call('connector/poll', { token: first.token, method: 'POST' })).status).toBe(401);
    expect((await call('connector/poll', { token: second.token, method: 'POST' })).status).toBe(200);
    expect((await call('disconnect', { scope, method: 'DELETE' })).status).toBe(200);
    expect((await call('connector/poll', { token: second.token, method: 'POST' })).status).toBe(401);
    expect((await call('connector/poll', { token: foreign.token, method: 'POST' })).status).toBe(200);
  });
});

describe('account-scoped durable AR jobs', () => {
  it('scopes requests, claims and results, and replays identical results idempotently', async () => {
    const connector = await pair();
    const foreign = await pair(other);
    const requested = await job(connector.token);
    expect((await call('requests', { scope: other, id: requested.id })).status).toBe(404);
    expect((await call('connector/result', { token: foreign.token, body: { id: requested.id, result } })).status).toBe(404);
    const replay = await (await call('connector/poll', { token: connector.token, method: 'POST' })).json() as any;
    expect(replay.jobs[0].id).toBe(requested.id);
    expect((await call('connector/result', { token: connector.token, body: { id: requested.id, result } })).status).toBe(200);
    expect((await call('connector/result', { token: connector.token, body: { id: requested.id, result } })).status).toBe(200);
    expect((await call('connector/result', { token: connector.token, body: { id: requested.id, result: { source: { ...source, text: 'different' } } } })).status).toBe(409);
    expect(await (await call('requests', { scope, id: requested.id })).json()).toMatchObject({ status: 'complete', result });
  });
  it('rejects jobs without a connected device, rejects unsupported sources, and erases expired temporary originals', async () => {
    expect((await call('requests', { scope, body: { kind: 'read', sourceId: 'source-1' } })).status).toBe(409);
    const connector = await pair();
    expect((await call('requests', { scope, body: { kind: 'read', sourceId: '../../private' } })).status).toBe(400);
    const requested = await job(connector.token);
    await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
    db.sqlite.prepare('UPDATE curate_ar_jobs SET expires_at=? WHERE id=?').run(Date.now() - 1, requested.id);
    expect(await (await call('requests', { scope, id: requested.id })).json()).toMatchObject({ status: 'expired' });
    expect((db.sqlite.prepare('SELECT result_json FROM curate_ar_jobs WHERE id=?').get(requested.id) as any).result_json).toBeNull();
  });
  it('bounds results, strips paths and refuses unclaimed jobs', async () => {
    const connector = await pair();
    const pending = await (await call('requests', { scope, body: { kind: 'read', sourceId: 'source-1' } })).json() as any;
    expect((await call('connector/result', { token: connector.token, body: { id: pending.id, result } })).status).toBe(409);
    await call('connector/poll', { token: connector.token, method: 'POST' });
    expect((await call('connector/result', { token: connector.token, body: { id: pending.id, result: { source: { ...source, text: 'x'.repeat(200001) } } } })).status).toBe(400);
    await call('connector/result', { token: connector.token, body: { id: pending.id, error: 'Failed /Users/private/document.md' } });
    const failed = await (await call('requests', { scope, id: pending.id })).json() as any;
    expect(failed.status).toBe('error');
    expect(failed.error).not.toContain('/Users');
    const search = await job(connector.token, 'search');
    expect((await call('connector/result', { token: connector.token, body: { id: search.id, result: { sources: Array.from({ length: 31 }, (_, i) => ({ id: `source-${i}`, title: 'Tea' })) } } })).status).toBe(400);
    await call('connector/result', { token: connector.token, body: { id: search.id, result: { sources: [{ id: 'source-1', title: 'Tea', path: '/Users/private.md', snippet: 'Tea notes' }] } } });
    expect(JSON.stringify(await (await call('requests', { scope, id: search.id })).json())).not.toContain('/Users');
  });
});

describe('reviewed AR references', () => {
  it('links only an exact excerpt from a completed scoped read, deduplicates and protects changes by expected hash', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
    const start = source.text.indexOf('A spring');
    const text = 'A spring harvest from Yiwu.';
    const body = { requestId: requested.id, entryId: 'tea-a', sourceId: source.id, title: source.title, hash: source.hash, text, start, end: start + text.length };
    expect((await call('links', { scope: other, body })).status).toBe(404);
    expect((await call('links', { scope, body: { ...body, entryId: 'tea-b' } })).status).toBe(404);
    expect((await call('links', { scope, body: { ...body, text: 'Invented source quote' } })).status).toBe(400);
    const linked = await (await call('links', { scope, body })).json() as any;
    expect(linked.link).toMatchObject({ entryId: 'tea-a', sourceId: source.id, hash: source.hash, text });
    expect(await (await call('links', { scope, body })).json()).toMatchObject({ link: { id: linked.link.id } });
    expect((await call('links', { scope, body: { ...body, start: 0, end: 11, text: 'First line.' } })).status).toBe(409);
    expect((await call('links', { scope, body: { ...body, start: 0, end: 11, text: 'First line.', update: true, expectedHash: source.hash } })).status).toBe(200);
    expect((await call('links', { scope: other, id: linked.link.id, method: 'DELETE' })).status).toBe(404);
    expect((await call('links', { scope, id: linked.link.id, method: 'DELETE' })).status).toBe(200);
    expect(await (await call('links', { scope, query: '?entryId=tea-a' })).json()).toEqual({ links: [] });
    expect((db.sqlite.prepare('SELECT result_json FROM curate_ar_jobs WHERE id=?').get(requested.id) as any).result_json).not.toBeNull();
  });
});

it('reports connection freshness and reassigns an interrupted claimed job to a newly paired connector', async () => {
  const first = await pair();
  expect(await (await call('status', { scope })).json()).toMatchObject({ paired: true, connected: false, lastSeen: null });
  const requested = await job(first.token);
  expect(await (await call('status', { scope })).json()).toMatchObject({ paired: true, connected: true });
  const replacement = await pair();
  const resumed = await (await call('connector/poll', { token: replacement.token, method: 'POST' })).json() as any;
  expect(resumed.jobs[0].id).toBe(requested.id);
  expect((await call('connector/result', { token: first.token, body: { id: requested.id, result } })).status).toBe(401);
  expect((await call('connector/result', { token: replacement.token, body: { id: requested.id, result } })).status).toBe(200);
  db.sqlite.prepare('UPDATE curate_ar_devices SET last_seen_at=? WHERE id=?').run(Date.now() - 121000, replacement.deviceId);
  expect(await (await call('status', { scope })).json()).toMatchObject({ paired: true, connected: false });
});

it('never turns a secret, shop JWT or unpaired device into connector authority', async () => {
  const start = await (await call('pair/start', { method: 'POST' })).json() as any;
  expect((await call('connector/poll', { token: start.deviceSecret, method: 'POST' })).status).toBe(401);
  expect((await call('connector/poll', { token: 'header.payload.signature', method: 'POST' })).status).toBe(401);
  expect(await (await call('pair/status', { id: start.deviceId, secret: start.deviceSecret })).json()).toMatchObject({ status: 'pending' });
  expect((await call('pair/claim', { body: { code: start.code } })).status).toBe(401);
});

it('rejects an expired read snapshot as link authority even when the original tea still exists', async () => {
  const connector = await pair();
  const requested = await job(connector.token);
  await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
  db.sqlite.prepare('UPDATE curate_ar_jobs SET expires_at=? WHERE id=?').run(Date.now() - 1, requested.id);
  const response = await call('links', { scope, body: { requestId: requested.id, entryId: 'tea-a', sourceId: source.id, title: source.title, hash: source.hash, text: source.text, start: 0, end: source.text.length } });
  expect(response.status).toBe(404);
  expect((db.sqlite.prepare('SELECT result_json FROM curate_ar_jobs WHERE id=?').get(requested.id) as any).result_json).toBeNull();
});

it('rejects malformed authenticated JSON and oversized bodies without reflecting private input', async () => {
  const connector = await pair();
  const malformed = await handleArBridge(new Request('https://teajia.test/api/curate/ar-create/connector/result', { method: 'POST', headers: { Authorization: `Bearer ${connector.token}`, 'Content-Type': 'application/json' }, body: '{private invalid input' }), { DB: db as unknown as D1Database }, undefined, 'connector/result');
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toMatchObject({ code: 'ar_invalid_json' });
  const oversized = await handleArBridge(new Request('https://teajia.test/api/curate/ar-create/connector/result', { method: 'POST', headers: { Authorization: `Bearer ${connector.token}`, 'Content-Length': '900001' }, body: '{}' }), { DB: db as unknown as D1Database }, undefined, 'connector/result');
  expect(oversized.status).toBe(413);
});

it('keeps a personal archive private from a different collaborator in the same account', async () => {
  const collaborator = { accountId: scope.accountId, userId: 'same-shop-collaborator' };
  const connector = await pair();
  const own = await job(connector.token);
  expect((await call('requests', { scope: collaborator, body: { kind: 'search', query: 'Private journal' } })).status).toBe(403);
  expect((await call('requests', { scope: collaborator, id: own.id })).status).toBe(404);
  expect(await (await call('status', { scope: collaborator })).json()).toMatchObject({ paired: true, canSearch: false });
  expect(await (await call('status', { scope })).json()).toMatchObject({ canSearch: true });
  await call('connector/result', { token: connector.token, body: { id: own.id, result } });
  const body = { requestId: own.id, entryId: 'tea-a', sourceId: source.id, title: source.title, hash: source.hash, text: source.text, start: 0, end: source.text.length };
  expect((await call('links', { scope: collaborator, body })).status).toBe(404);
  const linked = await (await call('links', { scope, body })).json() as any;
  expect(await (await call('links', { scope: collaborator, query: '?entryId=tea-a' })).json()).toMatchObject({ links: [{ id: linked.link.id, text: source.text }] });
});

it('never sends the old person\'s pending or claimed requests into a replacement person\'s archive', async () => {
  const replacementPerson = { accountId: scope.accountId, userId: 'another-owner' };
  const old = await pair();
  const claimed = await job(old.token);
  const pending = await (await call('requests', { scope, body: { kind: 'search', query: 'Old private question' } })).json() as any;
  const replacement = await pair(replacementPerson);
  expect(await (await call('connector/poll', { token: replacement.token, method: 'POST' })).json()).toEqual({ jobs: [] });
  for (const id of [claimed.id, pending.id]) {
    expect(await (await call('requests', { scope, id })).json()).toMatchObject({ status: 'error' });
    expect((await call('requests', { scope: replacementPerson, id })).status).toBe(404);
  }
  const own = await (await call('requests', { scope: replacementPerson, body: { kind: 'search', query: 'New own question' } })).json() as any;
  const poll = await (await call('connector/poll', { token: replacement.token, method: 'POST' })).json() as any;
  expect(poll.jobs).toEqual([{ id: own.id, kind: 'search', query: 'New own question' }]);
});


describe('full transcript references', () => {
  it('previews the entire scoped read without writing anything and keeps legacy excerpt bounds', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    const full = { ...source, text: 'Complete source material. '.repeat(900) };
    await call('connector/result', { token: connector.token, body: { id: requested.id, result: { source: full } } });
    const input = { requestId: requested.id, sourceId: full.id, title: full.title, hash: full.hash, text: full.text, start: 0, end: full.text.length, mode: 'full' };
    const changes = (db.sqlite.prepare('SELECT total_changes() AS n').get() as any).n;
    expect(await readTeaArExcerpt(db as unknown as D1Database, scope, input)).toEqual(input);
    expect((db.sqlite.prepare('SELECT total_changes() AS n').get() as any).n).toBe(changes);
    await expect(readTeaArExcerpt(db as unknown as D1Database, scope, { ...input, mode: 'excerpt' })).rejects.toMatchObject({ status: 400, code: 'ar_invalid_excerpt' });
    await expect(readTeaArExcerpt(db as unknown as D1Database, other, input)).rejects.toMatchObject({ status: 404, code: 'ar_read_not_found' });
    await expect(readTeaArExcerpt(db as unknown as D1Database, { ...scope, userId: 'another-person' }, input)).rejects.toMatchObject({ status: 404, code: 'ar_read_not_found' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_ar_links').get()).toEqual({ n: 0 });
  });
  it('rejects a trimmed passage advertised as a complete transcript and unknown modes', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
    const input = { requestId: requested.id, sourceId: source.id, title: source.title, hash: source.hash, text: source.text.slice(0, 11), start: 0, end: 11, mode: 'full' };
    await expect(readTeaArExcerpt(db as unknown as D1Database, scope, input)).rejects.toMatchObject({ status: 400, code: 'ar_full_transcript_mismatch' });
    await expect(readTeaArExcerpt(db as unknown as D1Database, scope, { ...input, mode: 'unknown' })).rejects.toMatchObject({ status: 400, code: 'ar_invalid_excerpt' });
  });
  it('retains full-reference mode on explicit save and refreshes the same link only with its expected hash', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    const full = { ...source, text: 'A complete original transcript. '.repeat(600) };
    await call('connector/result', { token: connector.token, body: { id: requested.id, result: { source: full } } });
    const input = { requestId: requested.id, entryId: 'tea-a', sourceId: full.id, title: full.title, hash: full.hash, text: full.text, start: 0, end: full.text.length, mode: 'full' };
    const saved = await call('links', { scope, body: input });
    expect(saved.status).toBe(201);
    const first = (await saved.json() as any).link;
    expect(first).toMatchObject({ mode: 'full', text: full.text });
    expect(await (await call('links', { scope, query: '?entryId=tea-a' })).json()).toMatchObject({ links: [{ id: first.id, mode: 'full', text: full.text }] });
    const refreshed = await job(connector.token);
    const changed = { ...full, hash: 'sha256:changed-original', text: full.text + 'A correction at the end.' };
    await call('connector/result', { token: connector.token, body: { id: refreshed.id, result: { source: changed } } });
    const replacement = { ...input, requestId: refreshed.id, hash: changed.hash, text: changed.text, end: changed.text.length };
    expect((await call('links', { scope, body: replacement })).status).toBe(409);
    const updated = await call('links', { scope, body: { ...replacement, update: true, expectedHash: full.hash } });
    expect(updated.status).toBe(200);
    expect((await updated.json() as any).link).toMatchObject({ id: first.id, mode: 'full', text: changed.text });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_ar_links WHERE entry_id=?').get('tea-a')).toEqual({ n: 1 });
  });
  it('requires explicit review when changing the scope of an unchanged source link', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
    const input = { requestId: requested.id, entryId: 'tea-a', sourceId: source.id, title: source.title, hash: source.hash, text: source.text, start: 0, end: source.text.length };
    const first = (await (await call('links', { scope, body: input })).json() as any).link;
    expect(first.mode).toBe('excerpt');
    expect((await call('links', { scope, body: { ...input, mode: 'full' } })).status).toBe(409);
    expect(await (await call('links', { scope, body: { ...input, mode: 'full', update: true, expectedHash: source.hash } })).json()).toMatchObject({ link: { id: first.id, mode: 'full' } });
  });
});


describe('idle connector database budget', () => {
  it('keeps three-second pickup while coalescing heartbeat writes across requests', async () => {
    const connector = await pair();
    const start = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    const prepare = vi.spyOn(db, 'prepare');
    for (let i = 0; i < 20; i++) {
      clock.mockReturnValue(start + i * 3000);
      expect(await (await call('connector/poll', { token: connector.token, method: 'POST' })).json()).toEqual({ jobs: [] });
    }
    // 60 baseline operations plus two heartbeat writes, formerly 120.
    expect(prepare).toHaveBeenCalledTimes(62);
    expect(prepare.mock.calls.filter(([sql]) => sql.startsWith('UPDATE curate_ar_devices'))).toHaveLength(2);
    expect(prepare.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    expect(await (await call('status', { scope })).json()).toMatchObject({ connected: true });
    const request = await (await call('requests', { scope, body: { kind: 'search', query: 'Yiwu' } })).json() as any;
    // A new job is claimed on the very next poll, inside the heartbeat interval.
    const picked = await (await call('connector/poll', { token: connector.token, method: 'POST' })).json() as any;
    expect(picked.jobs[0].id).toBe(request.id);
    await call('disconnect', { scope, method: 'DELETE' });
    expect((await call('connector/poll', { token: connector.token, method: 'POST' })).status).toBe(401);
  });

  it('erases expired originals on the next poll and still garbage collects old rows', async () => {
    const connector = await pair();
    const requested = await job(connector.token);
    await call('connector/result', { token: connector.token, body: { id: requested.id, result } });
    const now = Date.now();
    db.sqlite.prepare('UPDATE curate_ar_jobs SET expires_at=? WHERE id=?').run(now - 1, requested.id);
    expect(await (await call('connector/poll', { token: connector.token, method: 'POST' })).json()).toEqual({ jobs: [] });
    expect(db.sqlite.prepare('SELECT status,result_json,result_hash FROM curate_ar_jobs WHERE id=?').get(requested.id)).toMatchObject({ status: 'expired', result_json: null, result_hash: null });
    const unpaired = await (await call('pair/start', { method: 'POST' })).json() as any;
    db.sqlite.prepare('UPDATE curate_ar_devices SET pair_expires_at=? WHERE id=?').run(now - 25 * 3600000, unpaired.deviceId);
    db.sqlite.prepare('UPDATE curate_ar_jobs SET expires_at=? WHERE id=?').run(now - 25 * 3600000, requested.id);
    await expireArBridgeRequests(db as unknown as D1Database, now);
    expect(db.sqlite.prepare('SELECT id FROM curate_ar_jobs WHERE id=?').get(requested.id)).toBeUndefined();
    expect(db.sqlite.prepare('SELECT id FROM curate_ar_devices WHERE id=?').get(unpaired.deviceId)).toBeUndefined();
    expect(db.sqlite.prepare('SELECT id FROM curate_ar_devices WHERE id=?').get(connector.deviceId)).toBeTruthy();
  });
});
