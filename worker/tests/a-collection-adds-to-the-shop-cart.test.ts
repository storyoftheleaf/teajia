import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { collectionPricePerGram, collectionQuantityUnit } from '../src/collectionCart';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// A collection is the shop filtered for someone (Adrian, 2026-11-27): its Add
// goes to the shop's cart, the order keeps the price the link quoted, and a
// private tea on a live link can be ordered even though the shop does not list it.

const TOKEN = 'collectioncartordertoken0000000000001';
const SECRET = 'collection-cart-secret';
const databases: SqliteD1[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  databases.splice(0).forEach(db => db.close());
});

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD', whatsapp_number = '6281339712339' WHERE id = 'shop';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams, is_public, shown_in_shop)
    VALUES ('private-tea', 'shop', 'Dark', 'Liu Bao', 'Loose', 20, 'USD', 300, 1000, 0, 0);
    INSERT INTO collections (id, account_id, title, status) VALUES ('col', 'shop', 'For Daniel', 'active');
    INSERT INTO collection_items (id, collection_id, product_id, position, recommended_quantity, recommended_price_usd)
    VALUES ('ci', 'col', 'private-tea', 1, '50', 9.5);
    INSERT INTO collection_publications (id, collection_id, target_type, slug) VALUES ('pub', 'col', 'person', 'for-daniel');
  `);
  return db;
}

function order(db: SqliteD1, line: Record<string, unknown>) {
  const body = {
    source: 'website', store_slug: 'shop', tracking_token: TOKEN, ref_number: 'TJ-LINK',
    customer_name: 'Daniel', customer_contact: '', whatsapp_handoff: true, customer_location: 'Ubud, Indonesia',
    currency: 'USD', total_estimate_usd: 19,
    items: [{ id: 'private-tea', name: 'Liu Bao', category: 'tea', storeSlug: 'shop', quantityGrams: 100, packGrams: 100, packs: 1, pricePerGram: 0.19, totalPrice: 19, ...line }],
  };
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
}

describe('a collection adds to the shop cart', () => {
  it('orders a private tea from a live link at the price the link quoted', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const db = seed();
    const response = await order(db, { collectionSlug: 'for-daniel' });
    expect(response.status).toBe(201);
    // $9.50 for 50 g, so 100 g is $19.00, with no handling amount on top.
    const line = db.sqlite.prepare('SELECT quantity, price_at_sale FROM invoice_line_items').get() as { quantity: number; price_at_sale: number };
    expect(line.quantity).toBe(100);
    expect(Math.round(line.quantity * line.price_at_sale * 100) / 100).toBe(19);
  });

  it('prices a tea the link left unquoted by the shop\'s own rule', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const db = seed();
    db.sqlite.exec("UPDATE collection_items SET recommended_price_usd = NULL WHERE id = 'ci'");
    const response = await order(db, { collectionSlug: 'for-daniel' });
    expect(response.status).toBe(201);
    const line = db.sqlite.prepare('SELECT quantity, price_at_sale FROM invoice_line_items').get() as { quantity: number; price_at_sale: number };
    // Not the flat link rate: the shop's curve adds its handling amount.
    expect(line.quantity * line.price_at_sale).not.toBeCloseTo(19);
    expect(line.price_at_sale).toBeGreaterThan(0);
  });

  it('refuses the same private tea without its link', async () => {
    const db = seed();
    const response = await order(db, {});
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
  });

  it('refuses a link that has been taken down', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE collection_publications SET unpublished_at = datetime('now') WHERE id = 'pub'");
    const response = await order(db, { collectionSlug: 'for-daniel' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
  });

  it('reads a suggestion of cakes by the piece and of loose tea by the gram', () => {
    expect(collectionQuantityUnit({ product_type: 'Shou', form: 'Cake', recommended_quantity: '2' })).toBe('piece');
    expect(collectionQuantityUnit({ product_type: 'Shou', form: 'Cake', recommended_quantity: '50' })).toBe('g');
    expect(collectionPricePerGram({ product_type: 'Shou', form: 'Cake', recommended_quantity: '2', recommended_price_usd: 80, piece_weight_g: 357 }))
      .toBeCloseTo(80 / 714);
    expect(collectionPricePerGram({ product_type: 'Shou', form: 'Cake', recommended_quantity: '2', recommended_price_usd: 80 })).toBeNull();
    expect(collectionPricePerGram({ product_type: 'Red', form: 'Loose', recommended_quantity: '50', recommended_price_usd: null })).toBeNull();
  });
});
