import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

let database: SqliteD1 | undefined;
afterEach(() => { database?.close(); database = undefined; });

it('keeps public sold-out links scoped to their shop while browse shows stock for sale', async () => {
  const db = database = new SqliteD1('schema');
  seedIdentity(db, { accountId: 'shop', accountSlug: 'stock-test' });
  seedIdentity(db, { accountId: 'acc_teajia_bali', accountSlug: 'teajia-bali', userId: 'bali-owner' });
  db.exec(`INSERT INTO products (id, slug, account_id, product_name, type, fixed_retail_price_usd,
    stock_grams, quantity_units, status, is_public, shown_in_shop) VALUES
    ('sold', 'sold-tea', 'shop', 'Sold tea', 'Oolong', 1, 10, NULL, 'Sold Out', 1, 1),
    ('zero', 'zero-tea', 'shop', 'Zero tea', 'Oolong', 1, 0, NULL, 'Active', 1, 1),
    ('wares', 'wares', 'shop', 'Teaware with units', 'Teaware', 10, 0, 3, 'Active', 1, 1),
    ('zero-ware', 'zero-ware', 'shop', 'Teaware without units', 'Teaware', 10, 100, 0, 'Active', 1, 1),
    ('hidden', 'hidden-tea', 'shop', 'Hidden tea', 'Oolong', 1, 0, NULL, 'Sold Out', 1, 0),
    ('private', 'private-tea', 'shop', 'Private tea', 'Oolong', 1, 0, NULL, 'Sold Out', 0, 1),
    ('bali-sold', 'bali-tea', 'acc_teajia_bali', 'Bali tea', 'Oolong', 1, 0, NULL, 'Sold Out', 1, 1)`);

  async function request(path: string) {
    const response = await worker.fetch(new Request('https://demo.test' + path),
      { DB: db } as never, { waitUntil() {} } as never);
    return { status: response.status, body: await response.json() };
  }

  const shop = '/api/s/stock-test/products';
  expect(await request(shop)).toMatchObject({ status: 200, body: [{ id: 'wares' }] });
  expect(await request(shop + '/sold-tea')).toMatchObject({ status: 200, body: { id: 'sold', status: 'Sold Out' } });
  expect(await request(shop + '/sold')).toMatchObject({ status: 200, body: { id: 'sold' } });
  expect(await request(shop + '/zero-tea')).toMatchObject({ status: 200, body: { id: 'zero', stock_grams: 0 } });
  for (const address of ['hidden-tea', 'private-tea', 'bali-tea']) {
    expect(await request(shop + '/' + address)).toMatchObject({ status: 404 });
  }
  expect(await request('/api/products/public/bali-tea')).toMatchObject({ status: 200, body: { id: 'bali-sold' } });
  expect(await request('/api/products/public/sold-tea')).toMatchObject({ status: 404 });
});
