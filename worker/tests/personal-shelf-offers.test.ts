import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-offer-test-secret';
const dbs: SqliteD1[] = [];
afterEach(() => { while (dbs.length) dbs.pop()!.close(); });

function database() {
  const db = new SqliteD1('migrations');
  dbs.push(db);
  seedIdentity(db, { userId: 'seller', accountId: 'seller-account' });
  seedIdentity(db, { userId: 'other', accountId: 'other-account' });
  db.sqlite.prepare("UPDATE users SET shelf_enabled=1, shelf_slug='seller-tea', shelf_whatsapp='628123456789' WHERE id='seller'").run();
  db.sqlite.prepare(`INSERT INTO personal_cellar_items
    (id, owner_user_id, name, type, year, origin, notes, grams, image_url, shelf_published, chest_cost_amount, chest_cost_currency)
    VALUES ('holding', 'seller', 'Private supplier name', 'Oolong', 2020, 'Private source',
      'Secret sourcing note', 150, 'https://private.example/original.jpg', 0, 9, 'AUD')`).run();
  return db;
}

async function call(db: SqliteD1, path: string, method = 'GET', body?: unknown, user = 'seller') {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, name: user,
    active_account_id: `${user}-account`, platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': `${user}-account`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}
const offer = { name: 'Mountain Oolong', grams: 50, type: 'Oolong', year: 2021, origin: 'Taiwan', price_amount: 25, price_currency: 'USD' };
const publish = (db: SqliteD1, body: unknown = offer, user = 'seller') =>
  call(db, '/api/me/cellar/holding/publish-shelf', 'POST', body, user);
const publicRead = (db: SqliteD1, path: string) => worker.fetch(
  new Request(`https://worker.test${path}`), { DB: db as any } as any,
);
const publicShelf = async (db: SqliteD1) => (await publicRead(db, '/api/shelf/seller-tea')).json() as Promise<any>;
const holding = (db: SqliteD1) => db.sqlite.prepare("SELECT * FROM personal_cellar_items WHERE id='holding'").get() as any;

describe('a personal shelf offer', () => {
  it('requires a recorded purchase amount and currency before adding a tea', async () => {
    const db = database();
    const tea = { name: 'Spring oolong', grams: 120 };
    for (const invalid of [{}, { costAmount: '', costCurrency: 'USD' }, { costAmount: 15 },
      { costAmount: 15, costCurrency: 'UNK' }, { costAmount: -1, costCurrency: 'USD' }]) {
      expect((await call(db, '/api/me/cellar', 'POST', { ...tea, ...invalid })).status).toBe(400);
    }
    const response = await call(db, '/api/me/cellar', 'POST', { ...tea, costAmount: 0, costCurrency: 'CNY' });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ item: { costAmount: 0, costCurrency: 'Yuan' } });
  });

  it('requires a price for the offered weight and publishes only the asking price', async () => {
    const db = database();
    expect((await publish(db, { ...offer, price_amount: undefined, price_currency: undefined })).status).toBe(400);
    expect((await publish(db, { ...offer, price_amount: 0 })).status).toBe(400);
    expect((await publish(db, { ...offer, price_amount: 12.123 })).status).toBe(400);
    expect((await publish(db)).status).toBe(200);
    const listed = (await publicShelf(db)).items[0];
    expect(listed).toMatchObject({ grams: 50, price_amount: 25, price_currency: 'USD' });
    expect(listed).not.toHaveProperty('costAmount');
    expect(listed).not.toHaveProperty('cost_amount');
  });

  it('keeps a legacy holding private until its owner records cost and approves a priced offer', async () => {
    const db = database();
    db.sqlite.prepare(`UPDATE personal_cellar_items
      SET chest_cost_amount=NULL, chest_cost_currency=NULL, shelf_published=1,
          shelf_offer_name='Old offer', shelf_offer_grams=50
      WHERE id='holding'`).run();
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBe(409);
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { costAmount: 9, costCurrency: 'AUD' })).status).toBe(200);
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBe(200);
    expect((await publicShelf(db)).items[0]).toMatchObject({ grams: 50, price_amount: 25 });
  });

  it('publishes only approved buyer-safe fields, retries without duplicating, and withdraws without consuming the holding', async () => {
    const db = database();
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await publish(db)).status).toBeLessThan(300);
    const shelf = await publicShelf(db);
    expect(shelf.items).toHaveLength(1);
    expect(shelf.items[0]).toMatchObject({ name: 'Mountain Oolong', grams: 50, type: 'Oolong', year: 2021, origin: 'Taiwan', image_url: null });
    expect(JSON.stringify(shelf)).not.toMatch(/Private supplier name|Private source|Secret sourcing note|private\.example/);
    expect(holding(db)).toMatchObject({ name: 'Private supplier name', grams: 150, notes: 'Secret sourcing note' });
    expect((await call(db, '/api/me/cellar/holding/unpublish-shelf', 'POST', {})).status).toBeLessThan(300);
    expect((await publicShelf(db)).items).toEqual([]);
    expect(holding(db)).toMatchObject({ name: 'Private supplier name', grams: 150, notes: 'Secret sourcing note', shelf_offer_name: 'Mountain Oolong', shelf_offer_grams: 50 });
  });

  it('requires ownership, an enabled address, valid seller contact, a private holding and a positive quantity within the holding', async () => {
    const db = database();
    expect((await publish(db, offer, 'other')).status).toBeGreaterThanOrEqual(400);
    for (const grams of [0, -1, 151]) expect((await publish(db, { ...offer, grams })).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp=NULL WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='123' WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='628123456789', shelf_slug=NULL WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='628123456789', shelf_slug='seller-tea', shelf_enabled=0 WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_enabled=1 WHERE id='seller'").run();
    db.sqlite.prepare("UPDATE personal_cellar_items SET placement_status='requested' WHERE id='holding'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    expect((await publicShelf(db)).items).toEqual([]);
  });

  it('does not expose legacy published holdings until they are explicitly approved', async () => {
    const db = database();
    db.sqlite.prepare("UPDATE personal_cellar_items SET shelf_published=1 WHERE id='holding'").run();
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await publicShelf(db)).items).toHaveLength(1);
  });

  it('shares eligibility with the mapped public person and hides the offer when contact is removed', async () => {
    const db = database();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('seller-profile', 'seller-account', 'seller', 'Seller', 1)`).run();
    const person = async () => (await publicRead(db, '/api/people/seller-profile')).json();
    expect(await person()).toMatchObject({ id: 'seller-profile' });
    expect(await person()).not.toHaveProperty('shelf_slug');
    expect((await publish(db)).status).toBe(200);
    expect(await person()).toMatchObject({ shelf_slug: 'seller-tea', orderable_shelf_slug: 'seller-tea' });
    expect((await call(db, '/api/me/shelf', 'PUT', { whatsapp: '' })).status).toBe(200);
    expect(await publicShelf(db)).toMatchObject({ slug: 'seller-tea', whatsapp: null, items: [] });
    expect(await person()).not.toHaveProperty('shelf_slug');
  });

  it('keeps placement and an active offer mutually exclusive and withdraws when stock falls below the offer', async () => {
    const db = database();
    expect((await publish(db)).status).toBeLessThan(300);
    const placement = await call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' });
    expect(placement.status).toBeGreaterThanOrEqual(400);
    expect(holding(db).placement_status).toBe('private');
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { grams: 49 })).status).toBeLessThan(300);
    expect(holding(db).grams).toBe(49);
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
  });

  it('allows only one winner when an offer and a placement request overlap', async () => {
    const db = database();
    const [offerResult, placementResult] = await Promise.all([
      publish(db),
      call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' }),
    ]);
    expect([offerResult.status, placementResult.status].sort()).toEqual([200, 409]);
    const items = (await publicShelf(db)).items;
    expect(items).toHaveLength(offerResult.ok ? 1 : 0);
    expect(holding(db).placement_status).toBe(offerResult.ok ? 'private' : 'requested');
  });

  it('keeps the public quantity truthful when a stock edit overlaps publishing', async () => {
    const db = database();
    await Promise.all([
      publish(db),
      call(db, '/api/me/cellar/holding', 'PUT', { grams: 25 }),
    ]);
    expect(holding(db).grams).toBe(25);
    expect((await publicShelf(db)).items).toEqual([]);
  });

  it('moves the full holding once after withdrawal and location approval', async () => {
    const db = database();
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { label: 'Personal tasting group' })).status).toBe(200);
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await call(db, '/api/me/cellar/holding/unpublish-shelf', 'POST', {})).status).toBeLessThan(300);
    expect((await call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' })).status).toBeLessThan(300);
    const placementInbox = await call(db, '/api/cellar-placements', 'GET', undefined, 'other');
    expect(placementInbox.status).toBe(200);
    const { requests } = await placementInbox.json() as { requests: Record<string, unknown>[] };
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty('label');
    expect(requests[0]).not.toHaveProperty('shelfOffer');
    expect(requests[0]).not.toHaveProperty('costAmount');
    const approvals = await Promise.all([
      call(db, '/api/cellar-placements/holding/approve', 'POST', {}, 'other'),
      call(db, '/api/cellar-placements/holding/approve', 'POST', {}, 'other'),
    ]);
    expect(approvals.filter(response => response.status < 300)).toHaveLength(1);
    const item = holding(db);
    expect(item.placement_status).toBe('placed');
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { grams: 90 })).status).toBe(409);
    expect(holding(db).grams).toBe(150);
    expect((await publicShelf(db)).items).toEqual([]);
    expect(db.sqlite.prepare('SELECT stock_grams, owner_user_id FROM products WHERE id=?').get(item.linked_product_id))
      .toMatchObject({ stock_grams: 150, owner_user_id: 'seller' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE owner_user_id=?').get('seller')).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM product_listings WHERE legacy_product_id=?').get(item.linked_product_id)).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE product_id=?').get(item.linked_product_id)).toEqual({ n: 1 });
  });
});
