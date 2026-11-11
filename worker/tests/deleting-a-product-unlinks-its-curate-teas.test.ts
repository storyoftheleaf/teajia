import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Deleting a product clears `tea_compass_entries.draft_product_id` where it
 * named that product, in the same account and the same batch, so no Curate
 * tea is left pointing at a product that is gone. Other accounts' entries and
 * other links are untouched; the delete is still a delete.
 */

const SECRET = 'delete-unlink-secret';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', role: 'owner' });
  seedIdentity(db, { userId: 'other', accountId: 'elsewhere', role: 'owner' });
  db.sqlite.exec(`
    INSERT INTO products (id, account_id, type, product_name) VALUES
      ('gone', 'shop', 'Oolong', 'Gone'), ('kept', 'shop', 'Oolong', 'Kept'), ('theirs', 'elsewhere', 'Oolong', 'Theirs');
    INSERT INTO tea_compass_entries (id, account_id, user_id, name, photos, draft_product_id) VALUES
      ('a', 'shop', 'owner', 'A', '[]', 'gone'),
      ('b', 'shop', 'owner', 'B', '[]', 'kept'),
      ('c', 'elsewhere', 'other', 'C', '[]', 'theirs');
  `);
  return db;
}

async function remove(db: SqliteD1, accountId: string, user: string, productId: string) {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, active_account_id: accountId });
  return worker.fetch(new Request(`https://app.test/api/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId },
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

const links = (db: SqliteD1) => Object.fromEntries((db.sqlite.prepare('SELECT id, draft_product_id FROM tea_compass_entries ORDER BY id').all() as any[]).map(row => [row.id, row.draft_product_id]));

describe('deleting a product', () => {
  it('clears the Curate tea that pointed at it and nothing else', async () => {
    const db = seed();
    const response = await remove(db, 'shop', 'owner', 'gone');
    expect(response.status).toBe(200);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM products WHERE id = 'gone'").get()).toMatchObject({ n: 0 });
    expect(links(db)).toEqual({ a: null, b: 'kept', c: 'theirs' });
  });

  it('touches no link when the product is not in the caller\'s account', async () => {
    const db = seed();
    await remove(db, 'shop', 'owner', 'theirs');
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM products WHERE id = 'theirs'").get()).toMatchObject({ n: 1 });
    expect(links(db)).toEqual({ a: 'gone', b: 'kept', c: 'theirs' });
  });
});
