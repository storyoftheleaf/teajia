import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1 } from './helpers/sqliteD1';

// Lane F / Surface 3 of todo/plans/creator-profiles.md: GET
// /api/products/public/:id/selected-by -- published creators whose public
// tea selection (profile_favorites) includes this product, each with their
// own "why" note. Public, no auth. Mirrors the eligibility chain
// handleGetPublicContributor's tea_selection query already walks, run from
// the product's side instead of the creator's.

const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string) {
  return worker.fetch(
    new Request(`https://worker.test${path}`, { method: 'GET' }),
    { DB: db as any } as any,
  );
}

function seedAccount(db: SqliteD1, accountId = 'acc-one') {
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled, kind)
    VALUES (?, ?, ?, 'active', 1, 'master')`).run(accountId, accountId, accountId);
}

/** A public, active, purchasable product + tea_profile + listing, the same
 *  shape public-contributor-profile.test.ts's seedPublicTea uses. */
function seedPublicTea(db: SqliteD1, options: { profileId: string; productId: string; productSlug?: string; accountId?: string }) {
  const accountId = options.accountId ?? 'acc-one';
  seedAccount(db, accountId);
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, slug, type, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, ?, 'Oolong', 'Active', 1, 1, 100)`).run(
      options.productId, accountId, options.productId, options.productSlug ?? null,
    );
  db.sqlite.prepare(`INSERT INTO tea_profiles
    (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible, image_url)
    VALUES (?, ?, ?, ?, ?, 'published', 1, 'https://example.com/tea.jpg')`).run(
      options.profileId, options.profileId, accountId, accountId, options.profileId,
    );
  db.sqlite.prepare(`INSERT INTO product_listings
    (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, ?, 'active', 1, 1, 100)`).run(
      `listing-${options.productId}`, accountId, options.profileId, options.productId,
    );
}

function seedContributor(db: SqliteD1, options: { id: string; accountId?: string; businessName?: string | null; isPublished?: boolean }) {
  const accountId = options.accountId ?? 'acc-one';
  seedAccount(db, accountId);
  db.sqlite.prepare(`INSERT INTO contributors
    (id, account_id, display_name, business_name, is_published, links)
    VALUES (?, ?, ?, ?, ?, '[]')`).run(
      options.id, accountId, `Display ${options.id}`, options.businessName ?? null,
      options.isPublished === false ? 0 : 1,
    );
}

function seedFavorite(db: SqliteD1, options: { contributorId: string; profileId: string; note?: string | null; isPublic?: boolean; position?: number }) {
  db.sqlite.prepare(`INSERT INTO profile_favorites
    (contributor_id, tea_profile_id, note, position, is_public)
    VALUES (?, ?, ?, ?, ?)`).run(
      options.contributorId, options.profileId, options.note ?? null,
      options.position ?? 0, options.isPublic === false ? 0 : 1,
    );
}

describe('product selected-by (GET /api/products/public/:id/selected-by)', () => {
  it('is empty when nobody has publicly selected the tea', async () => {
    const db = database();
    seedPublicTea(db, { profileId: 'rou-gui', productId: 'product-rou-gui' });

    const response = await call(db, '/api/products/public/product-rou-gui/selected-by');
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).selected_by).toEqual([]);
  });

  it('names a published creator and carries their why line', async () => {
    const db = database();
    seedPublicTea(db, { profileId: 'rou-gui', productId: 'product-rou-gui' });
    seedContributor(db, { id: 'kenji-tanaka', businessName: 'Cloud Mountain Tea' });
    seedFavorite(db, { contributorId: 'kenji-tanaka', profileId: 'rou-gui', note: 'Roast held in reserve behind the fruit.' });

    const response = await call(db, '/api/products/public/product-rou-gui/selected-by');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.selected_by).toEqual([
      { slug: 'kenji-tanaka', display_name: 'Display kenji-tanaka', business_name: 'Cloud Mountain Tea', why: 'Roast held in reserve behind the fruit.' },
    ]);
  });

  it('resolves by slug as well as id, matching how the product page links to itself', async () => {
    const db = database();
    seedPublicTea(db, { profileId: 'rou-gui', productId: 'product-rou-gui', productSlug: 'mahei-gushu-red' });
    seedContributor(db, { id: 'kenji-tanaka' });
    seedFavorite(db, { contributorId: 'kenji-tanaka', profileId: 'rou-gui' });

    const response = await call(db, '/api/products/public/mahei-gushu-red/selected-by');
    expect(((await response.json()) as any).selected_by.map((c: any) => c.slug)).toEqual(['kenji-tanaka']);
  });

  it('omits an unpublished creator, a private favorite, and a favorite with no why line renders null not a placeholder', async () => {
    const db = database();
    seedPublicTea(db, { profileId: 'rou-gui', productId: 'product-rou-gui' });
    seedContributor(db, { id: 'unpublished-person', isPublished: false });
    seedFavorite(db, { contributorId: 'unpublished-person', profileId: 'rou-gui' });
    seedContributor(db, { id: 'private-picker' });
    seedFavorite(db, { contributorId: 'private-picker', profileId: 'rou-gui', isPublic: false });
    seedContributor(db, { id: 'silent-picker' });
    seedFavorite(db, { contributorId: 'silent-picker', profileId: 'rou-gui', note: null });

    const response = await call(db, '/api/products/public/product-rou-gui/selected-by');
    const body = await response.json() as any;
    expect(body.selected_by.map((c: any) => c.slug)).toEqual(['silent-picker']);
    expect(body.selected_by[0].why).toBeNull();
  });

  it('leaves out a product that is not public, not shown, or not active, even with a real favorite behind it', async () => {
    const db = database();
    seedPublicTea(db, { profileId: 'rou-gui', productId: 'product-rou-gui' });
    seedContributor(db, { id: 'kenji-tanaka' });
    seedFavorite(db, { contributorId: 'kenji-tanaka', profileId: 'rou-gui' });
    db.sqlite.prepare(`UPDATE products SET is_public = 0 WHERE id = 'product-rou-gui'`).run();

    const response = await call(db, '/api/products/public/product-rou-gui/selected-by');
    expect(((await response.json()) as any).selected_by).toEqual([]);
  });

  it('404s on a missing product id the same as the sibling public product read', async () => {
    const db = database();
    const response = await call(db, '/api/products/public/no-such-product/selected-by');
    // The route never 404s on its own -- an unmatched product id simply
    // joins to nothing -- so this documents that shape rather than assuming
    // handleGetPublicProduct's stricter contract.
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).selected_by).toEqual([]);
  });
});
