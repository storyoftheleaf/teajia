import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const JWT_SECRET = 'privacy-boundary-test';
const RSVP_LIMITER = { limit: async () => ({ success: true }) };

async function get(db: SqliteD1, path: string) {
  const response = await worker.fetch(new Request(`https://worker.test${path}`), { DB: db, JWT_SECRET } as any);
  return { status: response.status, body: await response.json() as any };
}

function seedStore(db: SqliteD1, accountId = 'account-a', slug = 'shop-a') {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, status, public_enabled, is_platform_owner)
    VALUES (?, ?, ?, 'active', 1, 1)`).run(accountId, slug, slug);
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, type, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, 'Visible tea', 'Oolong', 'Active', 1, 1, 100)`)
    .run(`tea-${accountId}`, accountId);
  db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, status, public_visibility, network_discovery, address_text)
    VALUES (?, ?, ?, 'Visible event', '2099-01-01', 'active', 'public', 1, 'Private venue address')`)
    .run(`event-${accountId}`, accountId, `event-${slug}`);
}

describe('public store and event privacy', () => {
  it.each([
    ['private', "UPDATE accounts SET public_enabled = 0 WHERE id = 'account-a'"],
    ['suspended', "UPDATE accounts SET status = 'suspended' WHERE id = 'account-a'"],
  ])('closes every public store and event read for a %s host', async (_label, sql) => {
    const db = new SqliteD1();
    try {
      seedStore(db);
      db.sqlite.exec(sql);
      for (const path of ['/api/s/shop-a', '/api/s/shop-a/products', '/api/s/shop-a/events', '/api/events/event-shop-a/public', '/api/events/event-shop-a/availability']) {
        expect((await get(db, path)).status).toBe(404);
      }
      expect((await get(db, '/api/events')).body).toEqual([]);
      const rsvp = await worker.fetch(new Request('https://worker.test/api/events/event-shop-a/rsvp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), { DB: db, JWT_SECRET, RSVP_LIMITER } as any);
      expect(rsvp.status).toBe(404);
    } finally { db.close(); }
  });

  it('hides private events but preserves direct unlisted event links and RSVPs', async () => {
    const db = new SqliteD1();
    try {
      seedStore(db);
      db.sqlite.exec("UPDATE events SET public_visibility = 'private', network_discovery = 0 WHERE id = 'event-account-a'");
      expect((await get(db, '/api/events')).body).toEqual([]);
      expect((await get(db, '/api/s/shop-a/events')).body).toEqual([]);
      const detail = await get(db, '/api/events/event-shop-a/public');
      expect(detail.status).toBe(404);
      expect(JSON.stringify(detail.body)).not.toContain('Private venue address');
      expect((await get(db, '/api/events/event-shop-a/availability')).status).toBe(404);
      const request = () => worker.fetch(new Request('https://worker.test/api/events/event-shop-a/rsvp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), { DB: db, JWT_SECRET, RSVP_LIMITER } as any);
      expect((await request()).status).toBe(404);

      db.sqlite.exec("UPDATE events SET public_visibility = 'unlisted' WHERE id = 'event-account-a'");
      expect((await get(db, '/api/events')).body).toEqual([]);
      expect((await get(db, '/api/s/shop-a/events')).body).toEqual([]);
      expect((await get(db, '/api/events/event-shop-a/public')).status).toBe(200);
      expect((await get(db, '/api/events/event-shop-a/availability')).status).toBe(200);
      expect((await request()).status).toBe(400); // RSVP reached payload validation.

      db.sqlite.exec("UPDATE events SET public_visibility = 'public' WHERE id = 'event-account-a'");
      expect((await get(db, '/api/events')).body).toEqual([]);
      expect((await get(db, '/api/s/shop-a/events')).body).toHaveLength(1);
      expect((await get(db, '/api/events/event-shop-a/public')).status).toBe(200);

      db.sqlite.exec("UPDATE events SET public_visibility = 'public', network_discovery = 1 WHERE id = 'event-account-a'");
      expect((await get(db, '/api/events')).body).toHaveLength(1);
      expect((await get(db, '/api/s/shop-a/events')).body).toHaveLength(1);
    } finally { db.close(); }
  });
});

describe('collection publication privacy', () => {
  it('keeps hidden products out of shop publications while retaining deliberate recipient links', async () => {
    const db = new SqliteD1();
    try {
      seedStore(db);
      db.sqlite.exec("UPDATE products SET is_public = 0, shown_in_shop = 0 WHERE id = 'tea-account-a'");
      db.sqlite.exec("INSERT INTO collections (id, account_id, title, status) VALUES ('collection-a', 'account-a', 'Selection', 'active')");
      db.sqlite.exec("INSERT INTO collection_items (id, collection_id, product_id, position) VALUES ('item-a', 'collection-a', 'tea-account-a', 0)");
      db.sqlite.exec("INSERT INTO collection_publications (id, collection_id, target_type, slug) VALUES ('pub-shop', 'collection-a', 'shop', 'shop-selection')");
      db.sqlite.exec("INSERT INTO collection_publications (id, collection_id, target_type, slug) VALUES ('pub-person', 'collection-a', 'person', 'recipient-selection')");

      expect((await get(db, '/api/collections/shop')).body.collections[0].items).toEqual([]);
      expect((await get(db, '/api/public/c/shop-selection')).body.items).toEqual([]);
      expect((await get(db, '/api/public/c/recipient-selection')).body.items).toHaveLength(1);

      db.sqlite.exec("UPDATE products SET is_public = 1 WHERE id = 'tea-account-a'");
      expect((await get(db, '/api/collections/shop')).body.collections[0].items).toEqual([]);
      expect((await get(db, '/api/public/c/shop-selection')).body.items).toEqual([]);
      db.sqlite.exec("UPDATE products SET is_public = 0, shown_in_shop = 1 WHERE id = 'tea-account-a'");
      expect((await get(db, '/api/collections/shop')).body.collections[0].items).toEqual([]);
      expect((await get(db, '/api/public/c/shop-selection')).body.items).toEqual([]);

      db.sqlite.exec("UPDATE products SET is_public = 1, shown_in_shop = 1 WHERE id = 'tea-account-a'");
      expect((await get(db, '/api/collections/shop')).body.collections[0].items).toHaveLength(1);
      expect((await get(db, '/api/public/c/shop-selection')).body.items).toHaveLength(1);

      db.sqlite.exec("UPDATE accounts SET public_enabled = 0 WHERE id = 'account-a'");
      expect((await get(db, '/api/collections/shop')).body.collections).toEqual([]);
      expect((await get(db, '/api/public/c/shop-selection')).status).toBe(410);
    } finally { db.close(); }
  });
});

describe('incident tenancy', () => {
  it('rejects a forged tenant and deduplicates only within a verified tenant', async () => {
    const db = new SqliteD1();
    try {
      seedIdentity(db, { userId: 'user-a', accountId: 'account-a' });
      seedIdentity(db, { userId: 'user-b', accountId: 'account-b' });
      const tokenA = await signedToken(JWT_SECRET, {
        sub: 'user-a', email: 'user-a@test.dev', name: 'A', active_account_id: 'account-a',
      });
      const tokenB = await signedToken(JWT_SECRET, {
        sub: 'user-b', email: 'user-b@test.dev', name: 'B', active_account_id: 'account-b',
      });
      const post = (token: string, account?: string) => worker.fetch(new Request('https://worker.test/api/incidents', {
        method: 'POST', headers: {
          Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          ...(account ? { 'X-Teajia-Account': account } : {}),
        },
        body: JSON.stringify({ category: 'server', severity: 'high', signature: 'shared-failure', route: '/test' }),
      }), { DB: db, JWT_SECRET } as any);

      expect((await post(tokenA, 'account-b')).status).toBe(403);
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM incident_ledger').get()).toMatchObject({ count: 0 });
      expect((await post(tokenA, 'account-a')).status).toBe(201);
      expect((await post(tokenA, 'account-a')).status).toBe(201);
      expect((await post(tokenB, 'account-b')).status).toBe(201);
      expect(db.sqlite.prepare('SELECT account_id, occurrence_count FROM incident_ledger ORDER BY account_id').all())
        .toEqual([{ account_id: 'account-a', occurrence_count: 2 }, { account_id: 'account-b', occurrence_count: 1 }]);

      const globalToken = await signedToken(JWT_SECRET, {
        sub: 'user-a', email: 'user-a@test.dev', name: 'A',
      });
      expect((await post(globalToken)).status).toBe(201);
      expect(db.sqlite.prepare('SELECT account_id FROM incident_ledger WHERE account_id IS NULL').get())
        .toMatchObject({ account_id: null });
    } finally { db.close(); }
  });
});
