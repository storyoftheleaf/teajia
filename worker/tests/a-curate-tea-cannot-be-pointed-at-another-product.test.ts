import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * `draft_product_id` is the server's link from a Curate tea to its holding,
 * and migration 0048's triggers copy the tea's given name onto whatever
 * product it names. Browsers still send the column on every sync (often null,
 * often stale), so it is not refused: a client write keeps the stored link
 * unless it sends that same link, or a product of this account made from this
 * entry. Driven through the worker's own routes against the migration ledger.
 */

const SECRET = 'draft-link-secret';
const ACCOUNT = 'shop';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(db, { userId: 'member', accountId: ACCOUNT, role: 'staff', bundles: [] });
  db.sqlite.exec(`
    INSERT INTO products (id, account_id, type, product_name, given_name) VALUES
      ('victim', '${ACCOUNT}', 'Oolong', 'Shop tea', 'Shop tea'),
      ('holding', '${ACCOUNT}', 'Oolong', 'Mine', 'Mine');
    UPDATE products SET source_compass_entry_id = NULL WHERE id = 'victim';
    INSERT INTO tea_compass_entries (id, account_id, user_id, name, photos) VALUES
      ('mine', '${ACCOUNT}', 'member', 'Mine', '[]'),
      ('linked', '${ACCOUNT}', 'owner', 'Linked', '[]');
  `);
  return db;
}

async function call(db: SqliteD1, user: string, method: string, path: string, body: unknown) {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, active_account_id: ACCOUNT });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

const link = (db: SqliteD1, id: string) => (db.sqlite.prepare('SELECT draft_product_id FROM tea_compass_entries WHERE id = ?').get(id) as any).draft_product_id;
const productName = (db: SqliteD1, id: string) => (db.sqlite.prepare('SELECT given_name FROM products WHERE id = ?').get(id) as any).given_name;

describe('a Curate tea cannot be pointed at another product by a client', () => {
  it('an ordinary member cannot rename another product through an entry update', async () => {
    const db = seed();
    const response = await call(db, 'member', 'PUT', '/api/compass/entries/mine', { draft_product_id: 'victim', given_name: 'Renamed' });
    expect(response.status).toBe(200);
    expect(link(db, 'mine')).toBeNull();
    expect(productName(db, 'victim')).toBe('Shop tea');
  });

  it('an ordinary member cannot rename another product through sync', async () => {
    const db = seed();
    const response = await call(db, 'member', 'POST', '/api/compass/sync', { entries: [{ id: 'mine', name: 'Mine', draft_product_id: 'victim', given_name: 'Renamed' }] });
    expect(response.status).toBe(200);
    expect(link(db, 'mine')).toBeNull();
    expect(productName(db, 'victim')).toBe('Shop tea');
  });

  it('an ordinary member cannot create an entry already pointed at another product', async () => {
    const db = seed();
    const response = await call(db, 'member', 'POST', '/api/compass/entries', { id: 'fresh', name: 'Fresh', draft_product_id: 'victim', given_name: 'Renamed' });
    expect(response.status).toBe(201);
    expect(link(db, 'fresh')).toBeNull();
    expect(productName(db, 'victim')).toBe('Shop tea');
  });

  it('a stale null or foreign id from an old browser leaves the stored link alone', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE products SET source_compass_entry_id = 'linked' WHERE id = 'holding'; UPDATE tea_compass_entries SET draft_product_id = 'holding' WHERE id = 'linked'");
    for (const sent of [null, 'victim']) {
      const response = await call(db, 'owner', 'POST', '/api/compass/sync', { entries: [{ id: 'linked', name: 'Linked again', draft_product_id: sent }] });
      expect(response.status).toBe(200);
      expect(link(db, 'linked'), String(sent)).toBe('holding');
    }
    expect(productName(db, 'victim')).toBe('Shop tea');
  });

  it('accepts the entry\'s own holding, which is the one link a client may restate', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE products SET source_compass_entry_id = 'mine' WHERE id = 'holding'");
    const response = await call(db, 'member', 'PUT', '/api/compass/entries/mine', { draft_product_id: 'holding' });
    expect(response.status).toBe(200);
    expect(link(db, 'mine')).toBe('holding');
  });

  it('lets someone who may edit the catalogue start a Curate record for a tea already on the shelf', async () => {
    const db = seed();
    // "Develop in Curate" from Stock: a new entry, first link, to a product no Curate tea was made into.
    const response = await call(db, 'owner', 'POST', '/api/compass/sync', { entries: [{ id: 'developed', name: 'Shop tea', draft_product_id: 'victim' }] });
    expect(response.status).toBe(200);
    expect(link(db, 'developed')).toBe('victim');
  });

  it('does not let that first link take a product another Curate tea was made into', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE products SET source_compass_entry_id = 'linked' WHERE id = 'holding'");
    const response = await call(db, 'owner', 'POST', '/api/compass/sync', { entries: [{ id: 'developed', name: 'Mine', draft_product_id: 'holding' }] });
    expect(response.status).toBe(200);
    expect(link(db, 'developed')).toBeNull();
  });
});
