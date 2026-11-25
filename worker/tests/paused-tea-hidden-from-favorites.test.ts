import { afterEach, expect, it } from 'vitest';
import { INWARD_BALI_LOT } from '../../shared/catalog/inwardOrders';
import worker from '../src/index';
import { SqliteD1 } from './helpers/sqliteD1';

// A tea whose ordering is paused (counted but not yet priced and sized) must
// not appear in a person's favourites or in a product page's "Selected by".

const { accountId, id: pausedId } = INWARD_BALI_LOT;
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled, kind)
    VALUES (?, 'bali', 'Bali', 'active', 1, 'master')`).run(accountId);
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, is_published, links)
    VALUES ('person', ?, 'Person', 1, '[]')`).run(accountId);
  for (const [productId, stockKnownAt] of [[pausedId, null], ['open-tea', '2026-11-24']] as const) {
    const profile = 'prof-' + productId;
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, slug, type, status, is_public, shown_in_shop,
        stock_grams, stock_known_at, stock_verified_at, fixed_retail_price_usd)
      VALUES (?, ?, ?, ?, 'Liu Bao', 'Active', 1, 1, 100, ?, ?, 2)`).run(productId, accountId, productId, productId, stockKnownAt, stockKnownAt);
    db.sqlite.prepare(`INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible, image_url)
      VALUES (?, ?, ?, ?, ?, 'published', 1, 'https://example.com/tea.jpg')`).run(profile, profile, accountId, accountId, profile);
    db.sqlite.prepare(`INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
      VALUES (?, ?, ?, ?, 'active', 1, 1, 100)`).run('listing-' + productId, accountId, profile, productId);
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public)
      VALUES ('person', ?, 'why', 0, 1)`).run(profile);
  }
  return db;
}

const get = (db: SqliteD1, path: string) => worker.fetch(
  new Request('https://worker.test' + path), { DB: db } as unknown as Parameters<typeof worker.fetch>[1],
);

it('keeps a paused tea out of the public favourites and the open one in', async () => {
  const body = await (await get(seed(), '/api/public/people/person/favorites')).json() as { favorites: Array<{ product_id: string }> };
  expect(body.favorites.map(f => f.product_id)).toEqual(['open-tea']);
});

it('keeps a paused tea out of the person page tea selection', async () => {
  const body = await (await get(seed(), '/api/people/person')).json() as { tea_selection: Array<{ product_id: string }> };
  expect(body.tea_selection.map(f => f.product_id)).toEqual(['open-tea']);
});

it('shows no "Selected by" on a paused tea and still shows it on an open one', async () => {
  const db = seed();
  expect(await (await get(db, '/api/products/public/' + pausedId + '/selected-by')).json()).toEqual({ selected_by: [] });
  const open = await (await get(db, '/api/products/public/open-tea/selected-by')).json() as { selected_by: unknown[] };
  expect(open.selected_by).toHaveLength(1);
});
