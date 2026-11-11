import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Promoting a Curate tea creates a product, and proposing an arrival proposes
 * stock. Both carry the same gate as creating a product (`catalog`), which is
 * also the gate on editing and rejecting a receipt proposal. Keeping private
 * Curate notes stays open to every member.
 */

const SECRET = 'promotion-gate-secret';
const ACCOUNT = 'shop';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(db, { userId: 'gatherer', accountId: ACCOUNT, role: 'staff', bundles: ['gather'] });
  seedIdentity(db, { userId: 'cataloguer', accountId: ACCOUNT, role: 'staff', bundles: ['catalog'] });
  db.sqlite.exec(`INSERT INTO tea_compass_entries (id, account_id, user_id, name, type, photos) VALUES
    ('gatherer-tea', '${ACCOUNT}', 'gatherer', 'Gathered', 'Oolong', '[]'),
    ('cataloguer-tea', '${ACCOUNT}', 'cataloguer', 'Catalogued', 'Oolong', '[]')`);
  return db;
}

async function call(db: SqliteD1, user: string, method: string, path: string, body?: unknown) {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, active_account_id: ACCOUNT });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

const arrival = { purpose: 'working', quantity: 100, unit: 'g', acquisition_kind: 'purchase', idempotency_key: 'k1' };
const count = (db: SqliteD1, table: string) => (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as any).n;

describe('promotion and arrival proposals need the catalog bundle', () => {
  it('a member without catalog cannot promote their own tea into a product', async () => {
    const db = seed();
    const response = await call(db, 'gatherer', 'POST', '/api/compass/entries/gatherer-tea/promote');
    expect(response.status).toBe(403);
    expect(count(db, 'products')).toBe(0);
  });

  it('a member without catalog cannot propose stock for their own tea', async () => {
    const db = seed();
    const response = await call(db, 'gatherer', 'POST', '/api/compass/entries/gatherer-tea/receipt-proposals', arrival);
    expect(response.status).toBe(403);
    expect(count(db, 'curate_receipt_proposals')).toBe(0);
  });

  it('a member with catalog can still do both on their own tea', async () => {
    const db = seed();
    expect((await call(db, 'cataloguer', 'POST', '/api/compass/entries/cataloguer-tea/receipt-proposals', arrival)).status).toBe(201);
    expect((await call(db, 'cataloguer', 'POST', '/api/compass/entries/cataloguer-tea/promote')).status).toBe(201);
  });

  it('a member without catalog still keeps their own Curate notes', async () => {
    const db = seed();
    expect((await call(db, 'gatherer', 'POST', '/api/compass/entries', { id: 'note', name: 'A note' })).status).toBe(201);
    expect((await call(db, 'gatherer', 'PUT', '/api/compass/entries/note', { notes: 'tasted well' })).status).toBe(200);
    expect((await call(db, 'gatherer', 'GET', '/api/compass/entries')).status).toBe(200);
    expect((await call(db, 'gatherer', 'DELETE', '/api/compass/entries/note')).status).toBe(200);
  });
});
