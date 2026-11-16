import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * `GET /api/products/:id/events` answers anonymous callers from the platform
 * account. It must only list sessions a visitor could open (the public event
 * page's conditions); a signed-in member of the account keeps the full list.
 */

const SECRET = 'product-events-secret';
const BALI = 'acc_teajia_bali';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: BALI, role: 'owner' });
  db.sqlite.exec(`
    INSERT INTO products (id, account_id, type, product_name) VALUES ('tea', '${BALI}', 'Oolong', 'Tea');
    INSERT INTO events (id, account_id, slug, title, event_date, status, public_visibility) VALUES
      ('open',     '${BALI}', 'open',     'Open',     '2026-01-05', 'active', 'public'),
      ('draft',    '${BALI}', 'draft',    'Draft',    '2026-01-04', 'draft',  'public'),
      ('private',  '${BALI}', 'private',  'Private',  '2026-01-03', 'active', 'private'),
      ('unlisted', '${BALI}', 'unlisted', 'Unlisted', '2026-01-02', 'active', 'unlisted'),
      ('archived', '${BALI}', 'archived', 'Archived', '2026-01-01', 'archived', 'public');
    INSERT INTO event_tea_menu (id, event_id, product_id, account_id) VALUES
      ('m1', 'open', 'tea', '${BALI}'), ('m2', 'draft', 'tea', '${BALI}'), ('m3', 'private', 'tea', '${BALI}'),
      ('m4', 'unlisted', 'tea', '${BALI}'), ('m5', 'archived', 'tea', '${BALI}');
  `);
  return db;
}

async function sessions(db: SqliteD1, signedIn: boolean) {
  const headers = new Headers();
  if (signedIn) {
    const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: BALI });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', BALI);
  }
  const response = await worker.fetch(new Request('https://app.test/api/products/tea/events', { headers }),
    { DB: db, JWT_SECRET: SECRET } as never, {} as never);
  expect(response.status).toBe(200);
  return ((await response.json()) as Array<{ id: string }>).map(row => row.id);
}

describe('the sessions a tea was poured at', () => {
  it('shows an anonymous visitor only sessions they could open', async () => {
    const db = seed();
    expect(await sessions(db, false)).toEqual(['open']);
  });

  it('hides everything from an anonymous visitor when the store is not public', async () => {
    const db = seed();
    db.sqlite.exec(`UPDATE accounts SET public_enabled = 0 WHERE id = '${BALI}'`);
    expect(await sessions(db, false)).toEqual([]);
  });

  it('keeps the full list for a signed-in member of the account', async () => {
    const db = seed();
    expect(await sessions(db, true)).toEqual(['open', 'draft', 'private', 'unlisted', 'archived']);
  });
});
