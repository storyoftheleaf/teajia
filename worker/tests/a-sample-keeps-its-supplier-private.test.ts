import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A sample page shows who supplied the tea (the vendor's name, their WeChat or
 * phone, the shop's notes) only to people in the shop that owns it.
 *
 * It used to show them to anyone signed in. Sample labels are handed to
 * customers, so a customer with an account who opened one saw the shop's
 * supplier and how to reach them.
 */

const JWT = 'sample-source-secret';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function call(db: SqliteD1, path: string, who: { sub: string; account: string } | null) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(JWT, { sub: who.sub, email: `${who.sub}@test.dev`, name: who.sub, active_account_id: who.account, platform_role: null });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', who.account);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, { headers }), { DB: db as any, JWT_SECRET: JWT } as any);
}

function seeded() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'staff-one', accountId: 'acc-shop' });
  seedIdentity(db, { userId: 'customer-one', accountId: 'acc-other' });
  db.sqlite.exec(`
    INSERT INTO tea_sample_sets (id, account_id, name) VALUES ('set-1', 'acc-shop', 'Yiwu run');
    INSERT INTO tea_samples (id, account_id, set_id, name, source_name, source_contact, notes)
      VALUES ('s-1', 'acc-shop', 'set-1', 'Yiwu Gushu', 'Wang Laoshi', '{"wechat":"wang_tea"}', 'paid 380');
  `);
  return db;
}

describe('a sample page', () => {
  it('hides the supplier from a signed-in customer of another shop', async () => {
    const db = seeded();
    const one = await (await call(db, '/api/samples/s-1', { sub: 'customer-one', account: 'acc-other' })).json() as any;
    expect(one.name).toBe('Yiwu Gushu');
    expect(one.source_name).toBeUndefined();
    expect(one.source_contact).toBeUndefined();
    expect(one.notes).toBeUndefined();
    const set = await (await call(db, '/api/samples/set/set-1', { sub: 'customer-one', account: 'acc-other' })).json() as any;
    expect(set.samples[0].source_name).toBeUndefined();
  });

  it('hides it from someone signed out', async () => {
    const db = seeded();
    const one = await (await call(db, '/api/samples/s-1', null)).json() as any;
    expect(one.source_name).toBeUndefined();
  });

  it('shows it to someone in the shop that owns the sample', async () => {
    const db = seeded();
    const one = await (await call(db, '/api/samples/s-1', { sub: 'staff-one', account: 'acc-shop' })).json() as any;
    expect(one.source_name).toBe('Wang Laoshi');
    expect(one.notes).toBe('paid 380');
    const set = await (await call(db, '/api/samples/set/set-1', { sub: 'staff-one', account: 'acc-shop' })).json() as any;
    expect(set.samples[0].source_name).toBe('Wang Laoshi');
  });
});

/**
 * A viewer could list every sample with its supplier's contact, and delete a
 * shared sourcing trip, which unlinked every teammate's teas from it.
 */
describe('a viewer in the shop', () => {
  const as = async (db: SqliteD1, sub: string, path: string, method = 'GET') => {
    const auth = await signedToken(JWT, { sub, email: `${sub}@test.dev`, name: sub, active_account_id: 'acc-shop', platform_role: null });
    return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${auth}`, 'X-Teajia-Account': 'acc-shop' } }), { DB: db as any, JWT_SECRET: JWT } as any);
  };

  it('cannot list samples or delete a trip; someone who gathers can', async () => {
    const db = seeded();
    seedIdentity(db, { userId: 'viewer-one', accountId: 'acc-shop', role: 'viewer', bundles: [] });
    seedIdentity(db, { userId: 'gatherer-one', accountId: 'acc-shop', role: 'staff', bundles: ['gather'] });
    db.sqlite.exec(`INSERT INTO curate_journeys (id, account_id, name, created_by_user_id) VALUES ('j-1', 'acc-shop', 'Yiwu trip', 'staff-one')`);

    expect((await as(db, 'viewer-one', '/api/admin/samples')).status).toBe(403);
    expect((await as(db, 'viewer-one', '/api/admin/sample-sets')).status).toBe(403);
    expect((await as(db, 'viewer-one', '/api/curate/journeys/j-1', 'DELETE')).status).toBe(403);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_journeys WHERE id = ?').get('j-1')).toEqual({ n: 1 });

    expect((await as(db, 'gatherer-one', '/api/admin/samples')).status).toBe(200);
  });
});
