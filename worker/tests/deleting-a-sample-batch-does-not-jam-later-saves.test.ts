import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const SECRET = 'sample-batch-delete-secret';
const databases: SqliteD1[] = [];

afterEach(() => databases.splice(0).forEach((db) => db.close()));

async function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner-a', accountId: 'account-a', role: 'owner', bundles: ['gather', 'catalog', 'stock', 'publish'] });
  seedIdentity(db, { userId: 'owner-b', accountId: 'account-b', role: 'owner', bundles: ['gather', 'catalog', 'stock', 'publish'] });
  db.sqlite.prepare("INSERT INTO tea_sample_sets (id,account_id,name,purpose,user_id) VALUES ('batch-a','account-a','Spring samples','sourcing','owner-a')").run();
  db.sqlite.prepare("INSERT INTO tea_compass_entries (id,account_id,user_id,name,sample_set_id,sample_state) VALUES ('sample-tea','account-a','owner-a','Sample tea','batch-a','requested'),('untouched-a','account-a','owner-a','Untouched A',NULL,NULL),('untouched-b','account-b','owner-b','Untouched B',NULL,NULL)").run();
  const token = await signedToken(SECRET, { sub: 'owner-a', email: 'owner-a@test.dev', active_account_id: 'account-a' });
  const call = (path: string, init: RequestInit) => worker.fetch(new Request(`https://worker.test${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'account-a', 'Content-Type': 'application/json' },
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
  return { db, call };
}

describe('deleting a sample batch cannot jam later tea saves', () => {
  it('persists a different tea when a stale client retries the deleted batch link', async () => {
    const { db, call } = await setup();

    const removed = await call('/api/admin/sample-sets/batch-a', { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(db.sqlite.prepare("SELECT archived FROM tea_sample_sets WHERE id='batch-a' AND account_id='account-a'").get()).toEqual({ archived: 1 });
    expect(db.sqlite.prepare("SELECT sample_set_id,sample_state FROM tea_compass_entries WHERE id='sample-tea' AND account_id='account-a'").get()).toEqual({ sample_set_id: null, sample_state: null });

    const saved = await call('/api/compass/sync', {
      method: 'POST',
      body: JSON.stringify({ entries: [
        { id: 'sample-tea', name: 'Stale retry', sample_set_id: 'batch-a', sample_state: 'requested' },
        { id: 'different-tea', name: 'Different tea' },
      ] }),
    });
    const result = await saved.json() as Record<string, unknown>;

    expect({
      status: saved.status,
      result,
      differentTea: db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='different-tea' AND account_id='account-a'").get(),
      untouchedA: db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-a' AND account_id='account-a'").get(),
      untouchedB: db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-b' AND account_id='account-b'").get(),
      foreignDifferentTea: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_compass_entries WHERE id='different-tea' AND account_id='account-b'").get(),
    }).toEqual({
      status: 200,
      result: expect.objectContaining({ syncedIds: expect.arrayContaining(['different-tea']) }),
      differentTea: { name: 'Different tea' },
      untouchedA: { name: 'Untouched A' },
      untouchedB: { name: 'Untouched B' },
      foreignDifferentTea: { count: 0 },
    });
  });

  it('keeps an app-created deleted request cleared and makes repeated stale retries idempotent', async () => {
    const { db, call } = await setup();
    const created = await call('/api/compass/entries', {
      method: 'POST', body: JSON.stringify({ id: 'owner-shape', name: 'Requested sample', sample_state: 'requested' }),
    });
    expect(created.status).toBe(201);
    const createdTea = await created.json() as { sample_set_id: string };
    const setId = createdTea.sample_set_id;
    expect(setId).toBeTruthy();
    expect((db.sqlite.prepare('SELECT purpose,archived FROM tea_sample_sets WHERE id=?').get(setId) as object)).toEqual({ purpose: 'sourcing', archived: 0 });

    expect((await call(`/api/admin/sample-sets/${setId}`, { method: 'DELETE' })).status).toBe(200);
    const before = {
      sets: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_sample_sets WHERE account_id='account-a'").get(),
      activePortions: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_samples WHERE account_id='account-a' AND archived_at IS NULL").get(),
    };
    const payload = { entries: [
      { id: 'owner-shape', name: 'Requested sample', sample_state: 'requested', sample_set_id: setId },
      { id: 'owner-different', name: 'Owner different tea' },
    ] };

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call('/api/compass/sync', { method: 'POST', body: JSON.stringify(payload) });
      expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
      expect(await response.json()).toMatchObject({ syncedIds: expect.arrayContaining(['owner-shape', 'owner-different']) });
    }

    expect(db.sqlite.prepare("SELECT sample_set_id,sample_state FROM tea_compass_entries WHERE id='owner-shape'").get()).toEqual({ sample_set_id: null, sample_state: null });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='owner-different' AND account_id='account-a'").get()).toEqual({ name: 'Owner different tea' });
    expect(db.sqlite.prepare('SELECT archived FROM tea_sample_sets WHERE id=?').get(setId)).toEqual({ archived: 1 });
    expect({
      sets: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_sample_sets WHERE account_id='account-a'").get(),
      activePortions: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_samples WHERE account_id='account-a' AND archived_at IS NULL").get(),
    }).toEqual(before);
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-a'").get()).toEqual({ name: 'Untouched A' });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-b' AND account_id='account-b'").get()).toEqual({ name: 'Untouched B' });
  });

  it.each([
    ['foreign open', 'foreign-open'],
    ['foreign archived', 'foreign-archived'],
    ['unknown', 'missing-set'],
  ])('still refuses a %s sample set without writing any tea', async (_label, setId) => {
    const { db, call } = await setup();
    if (setId.startsWith('foreign-')) {
      db.sqlite.prepare('INSERT INTO tea_sample_sets (id,account_id,name,purpose,user_id,archived) VALUES (?,\'account-b\',?,\'sourcing\',\'owner-b\',?)')
        .run(setId, setId, setId === 'foreign-archived' ? 1 : 0);
    }
    const response = await call('/api/compass/sync', { method: 'POST', body: JSON.stringify({ entries: [
      { id: 'refused-stale', name: 'Refused stale', sample_state: 'requested', sample_set_id: setId },
      { id: 'blocked-new', name: 'Must not be written' },
    ] }) });
    expect(response.status).toBe(404);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_compass_entries WHERE id IN ('refused-stale','blocked-new')").get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-a'").get()).toEqual({ name: 'Untouched A' });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='untouched-b' AND account_id='account-b'").get()).toEqual({ name: 'Untouched B' });
  });

  it('keeps a newer active sample relationship when a legacy row retries the archived one', async () => {
    const { db, call } = await setup();
    expect((await call('/api/admin/sample-sets/batch-a', { method: 'DELETE' })).status).toBe(200);
    const createdSet = await call('/api/admin/sample-sets', {
      method: 'POST', body: JSON.stringify({ id: 'batch-b', name: 'Replacement batch', purpose: 'sourcing' }),
    });
    expect(createdSet.status).toBe(201);
    const linked = await call('/api/compass/entries/sample-tea', {
      method: 'PUT', body: JSON.stringify({ sample_set_id: 'batch-b', sample_state: 'tasted' }),
    });
    expect(linked.status, JSON.stringify(await linked.clone().json())).toBe(200);
    expect(await linked.json()).toMatchObject({ sample_set_id: 'batch-b', sample_state: 'tasted' });
    const before = {
      sets: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_sample_sets WHERE account_id='account-a'").get(),
      activePortions: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_samples WHERE account_id='account-a' AND archived_at IS NULL").get(),
    };

    const response = await call('/api/compass/sync', { method: 'POST', body: JSON.stringify({ entries: [
      { id: 'sample-tea', name: 'Legacy whole row', sample_set_id: 'batch-a', sample_state: 'requested' },
      { id: 'newer-link-different', name: 'Different after newer link' },
    ] }) });

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({ syncedIds: expect.arrayContaining(['sample-tea', 'newer-link-different']) });
    expect(db.sqlite.prepare("SELECT sample_set_id,sample_state FROM tea_compass_entries WHERE id='sample-tea'").get()).toEqual({ sample_set_id: 'batch-b', sample_state: 'tasted' });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='newer-link-different'").get()).toEqual({ name: 'Different after newer link' });
    expect(db.sqlite.prepare("SELECT archived FROM tea_sample_sets WHERE id='batch-a'").get()).toEqual({ archived: 1 });
    expect({
      sets: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_sample_sets WHERE account_id='account-a'").get(),
      activePortions: db.sqlite.prepare("SELECT COUNT(*) AS count FROM tea_samples WHERE account_id='account-a' AND archived_at IS NULL").get(),
    }).toEqual(before);
  });
});
