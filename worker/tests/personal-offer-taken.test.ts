import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { createSeller, json, mei, offer, openStore, request } from './helpers/personalSellerPilot';
import { PERSONAL_OFFER_TAKEN } from '../src/personalOfferTaken';

// A second buyer for a pack already held, or sold, is told so plainly
// instead of being filed a draft request that can never be filled.
const databases: SqliteD1[] = [];
beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); })));
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });

async function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  const seller = await createSeller(db, mei);
  await json(await openStore(db, seller.actor)).catch(() => undefined);
  const { product_id: productId } = await json<{ product_id: string }>(
    await request(db, seller.offerPath, { actor: seller.actor, method: 'POST', body: offer }), 201);
  let n = 0;
  const order = () => request(db, '/api/inquiries', { method: 'POST', body: {
    source: 'website', store_slug: seller.slug, tracking_token: `taken-pack-order-token-${String(++n).padStart(16, '0')}`, ref_number: `TJ-TAKEN-${n}`,
    customer_name: 'Second buyer', customer_contact: 'second@example.test', customer_location: 'Austin, TX, United States', currency: 'USD', total_estimate_usd: 25,
    items: [{ id: productId, name: offer.name, category: 'tea', storeSlug: seller.slug, quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0.5, totalPrice: 25 }],
  } });
  return { db, seller, productId, order };
}

const drafts = (db: SqliteD1) => (db.sqlite.prepare('SELECT count(*) AS n FROM inquiries').get() as { n: number }).n;

describe('a personal offer pack that is already taken', () => {
  it('tells the second buyer it has just been taken while another buyer holds it', async () => {
    const { db, seller, productId, order } = await setup();
    db.sqlite.prepare("INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at) VALUES('hold','" + seller.actor.accountId + "','first-buyer',?,50,datetime('now','+1 day'))").run(productId);
    const before = drafts(db);
    const response = await order();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: PERSONAL_OFFER_TAKEN, code: 'personal_offer_taken' });
    expect(drafts(db)).toBe(before);
  });

  it('says the same once the pack has sold', async () => {
    const { db, productId, order } = await setup();
    db.sqlite.prepare('UPDATE products SET stock_grams = 0 WHERE id = ?').run(productId);
    const response = await order();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: PERSONAL_OFFER_TAKEN });
  });

  it('still takes the order when the hold has lapsed', async () => {
    const { db, seller, productId, order } = await setup();
    db.sqlite.prepare("INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at) VALUES('old','" + seller.actor.accountId + "','first-buyer',?,50,datetime('now','-1 hour'))").run(productId);
    expect((await order()).status).toBe(201);
  });
});
