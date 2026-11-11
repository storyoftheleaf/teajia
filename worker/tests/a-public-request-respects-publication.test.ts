import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/**
 * The unauthenticated order request path may only price and accept a tea the
 * public catalogue shows: public, shown in the shop, Active. A Draft, held or
 * sold-out tea answers exactly as an unknown id does. Custom lines (no id)
 * are untouched.
 */

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD' WHERE id = 'shop';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams, status, is_public, shown_in_shop) VALUES
      ('listed', 'shop', 'Red', 'Listed', 'Loose', 20, 'USD', 300, 1000, 'Active', 1, 1),
      ('draft',  'shop', 'Red', 'Draft',  'Loose', 20, 'USD', 300, 1000, 'Draft',  1, 1),
      ('held',   'shop', 'Red', 'Held',   'Loose', 20, 'USD', 300, 1000, 'Active', 1, 0),
      ('hidden', 'shop', 'Red', 'Hidden', 'Loose', 20, 'USD', 300, 1000, 'Active', 0, 1),
      ('sold',   'shop', 'Red', 'Sold',   'Loose', 20, 'USD', 300, 1000, 'Sold Out', 1, 1);
  `);
  return db;
}

let token = 0;
function request(db: SqliteD1, source: 'website' | 'cart', items: Array<Record<string, unknown>>) {
  token += 1;
  const body = {
    source, store_slug: 'shop', tracking_token: `publicationtrackingtoken${String(token).padStart(16, '0')}`, ref_number: `TJ-${token}`,
    customer_name: 'Guest', customer_contact: 'guest@example.com', customer_location: 'Ubud, Indonesia',
    currency: 'USD', total_estimate_usd: 14, items,
  };
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: 'publication-secret', INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
}

const line = (id: string | undefined, name = 'A tea') => ({
  ...(id ? { id } : { custom: true }), name, category: 'tea', storeSlug: 'shop', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14,
});

describe('a public order request respects publication', () => {
  for (const source of ['website', 'cart'] as const) {
    it(`${source}: a listed tea is accepted`, async () => {
      const db = seed();
      const response = await request(db, source, [line('listed')]);
      expect(response.status).toBe(201);
    });

    it(`${source}: draft, held, hidden and sold-out teas answer as an unknown id does`, async () => {
      const db = seed();
      const unknown = await request(db, source, [line('no-such-tea')]);
      const unknownBody = await unknown.json();
      for (const id of ['draft', 'held', 'hidden', 'sold']) {
        const response = await request(db, source, [line(id)]);
        expect(response.status, id).toBe(unknown.status);
        expect(await response.json(), id).toEqual(unknownBody);
      }
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toMatchObject({ n: 0 });
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toMatchObject({ n: 0 });
    });

    it(`${source}: a custom line with no product id still goes through`, async () => {
      const db = seed();
      const response = await request(db, source, [line(undefined, 'Something you do not list')]);
      expect(response.status).toBe(201);
    });
  }
});
