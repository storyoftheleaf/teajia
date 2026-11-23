import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

const offerData = { excerpt: 'Orchid over warm stone', byline: 'M.' };
const offerPath = '/api/tasting-journal/journal-a/offers/sitting-a';
const queue = '/api/admin/tasting-note-candidates';
const direct = '/api/admin/customer-tasting-notes';
const listing = '/api/products/lot-a/impressions';
const main = '/api/s/shop-a/tasting-excerpts';

async function setup(guestAccount = 'shop-a') {
  const db = new SqliteD1('migrations');
  databases.push(db);
  const JWT_SECRET = 'synthetic-tasting-excerpts';
  const publisher = seedIdentity(db, { userId: 'publisher', accountId: 'shop-a' });
  const catalog = seedIdentity(db, { userId: 'catalog', accountId: 'shop-a', role: 'staff', bundles: ['catalog'] });
  const other = seedIdentity(db, { userId: 'other', accountId: 'shop-b' });
  // The ordinary guest has no staff membership in either shop.
  db.exec("INSERT INTO users (id, email, name, password_hash) VALUES ('guest', 'guest@test.dev', 'Private name', 'test')");
  const guest = { userId: 'guest', email: 'guest@test.dev', accountId: guestAccount };
  db.exec(`
    INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop,
                          stock_grams, stock_known_at, fixed_retail_price_usd)
    VALUES ('lot-a', 'shop-a', 'Spring Oolong', 'Oolong', 'Active', 1, 1, 100, '2026-11-21', 1),
           ('lot-b', 'shop-a', 'Spring Oolong', 'Oolong', 'Active', 1, 1, 100, '2026-11-21', 1)
  `);

  const identities = { guest, publisher, catalog, other };
  const sessions = new Map(await Promise.all(Object.entries(identities).map(async ([role, me]) => [
    role, await signedToken(JWT_SECRET, { sub: me.userId, email: me.email, active_account_id: me.accountId }),
  ] as const)));

  async function call(path: string, method = 'GET', body?: unknown, role?: keyof typeof identities) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (role) headers.set('Authorization', `Bearer ${sessions.get(role)}`);
    const response = await worker.fetch(new Request(`https://demo.test${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, JWT_SECRET } as never, { waitUntil() {} } as never);
    return { status: response.status, body: await response.json() as any, cache: response.headers.get('Cache-Control') };
  }

  const saved = await call('/api/tasting-journal', 'POST', {
    id: 'journal-a', product_id: 'lot-a',
    note: { personalNote: 'Private journal paragraph.' },
    tastings: [{ id: 'sitting-a', tasting: { voiceNote: 'Orchid over warm stone. Private sitting detail.' } }],
  }, 'guest');
  expect(saved).toMatchObject({ status: 201, body: { id: 'journal-a' } });
  return { db, call };
}

it('keeps the journal and legacy stars out of review and proves exact-lot consent through both placements', async () => {
  const { db, call } = await setup();
  expect((await call(direct, 'GET', undefined, 'publisher')).body).toEqual([]);
  expect((await call(`${direct}/decide`, 'POST', {
    journal_entry_id: 'journal-a', note_key: 'personal', source_text: 'Private journal paragraph.',
  }, 'publisher')).status).toBe(404);
  db.exec(`
    INSERT INTO tasting_note_candidates
      (id, account_id, journal_entry_id, note_key, product_id, author_user_id, source_text)
    VALUES ('legacy-star', 'shop-a', 'journal-a', 'sitting-a', 'lot-a', 'guest', 'Private sitting detail.')
  `);
  expect((await call(queue, 'GET', undefined, 'publisher')).body).toEqual([]);
  expect((await call(`${queue}/legacy-star/promote`, 'POST', {}, 'publisher')).status).toBe(404);
  expect((await call(offerPath, 'PUT', offerData)).status).toBe(401);
  expect((await call(offerPath, 'PUT', offerData, 'other')).status).toBe(404);
  expect((await call(offerPath, 'PUT', { ...offerData, byline: ' ' }, 'guest')).status).toBe(400);
  expect((await call(offerPath, 'PUT', { ...offerData, excerpt: 'Private journal paragraph.' }, 'guest')).status).toBe(422);
  expect((await call(offerPath, 'PUT', { ...offerData, excerpt: 'Made up' }, 'guest')).status).toBe(422);

  const offered = await call(offerPath, 'PUT', { ...offerData, product_id: 'lot-b' }, 'guest');
  expect(offered).toMatchObject({
    status: 200,
    body: { productId: 'lot-a', sourceText: offerData.excerpt, attributionName: offerData.byline, status: 'starred' },
  });
  const { id } = offered.body;
  expect((await call(offerPath, 'PUT', offerData, 'guest')).body.id).toBe(id);
  expect((await call(offerPath, 'GET', undefined, 'guest')).body).toEqual(offered.body);
  expect((await call(offerPath, 'GET', undefined, 'other')).body).toBeNull();
  expect((await call(offerPath, 'PUT', { ...offerData, byline: 'Someone else' }, 'guest')).status).toBe(409);
  expect((await call(queue, 'GET', undefined, 'other')).body).toEqual([]);
  expect((await call(queue, 'GET', undefined, 'catalog')).status).toBe(403);
  const review = await call(direct, 'GET', undefined, 'publisher');
  expect(review.body).toEqual([expect.objectContaining({ authorName: 'M.', text: offerData.excerpt, status: 'open' })]);
  expect(JSON.stringify(review.body)).not.toMatch(/Private (name|sitting|journal)/);

  const approve = `${queue}/${id}/promote`;
  expect((await call(approve, 'POST', {}, 'catalog')).status).toBe(403);
  expect((await call(approve, 'POST', { attribution_name: 'Changed' }, 'publisher')).status).toBe(422);
  expect((await call(approve, 'POST', { edited_text: 'Rewritten' }, 'publisher')).status).toBe(422);
  expect((await call(listing)).body).toEqual([]);
  const approved = await call(approve, 'POST', {}, 'publisher');
  expect(approved).toMatchObject({ status: 201, body: { showOnListing: false, showOnMainPage: false } });
  expect((await call(approve, 'POST', {}, 'publisher')).status).toBe(409);
  const impressionId = approved.body.id;
  expect((await call(`${queue}?status=promoted`, 'GET', undefined, 'publisher')).body)
    .toEqual([expect.objectContaining({ id, impressionId, showOnListing: false, showOnMainPage: false })]);
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);

  const placements = `/api/admin/tasting-impressions/${impressionId}/placements`;
  expect((await call(placements, 'PUT', { show_on_listing: true }, 'other')).status).toBe(404);
  expect((await call(placements, 'PUT', { show_on_listing: true }, 'catalog')).status).toBe(403);
  expect((await call(placements, 'PUT', { show_on_main_page: 'true' }, 'publisher')).status).toBe(400);
  expect(await call(placements, 'PUT', { show_on_main_page: true }, 'publisher')).toMatchObject({
    status: 200, body: { showOnListing: false, showOnMainPage: true },
  });
  const publicExcerpt = {
    id: impressionId, productId: 'lot-a', text: offerData.excerpt, attributionName: 'M.',
    attributionDetail: null, publishedAt: approved.body.publishedAt,
  };
  expect((await call(listing)).body).toEqual([]);
  expect(await call(main)).toMatchObject({ body: [publicExcerpt], cache: 'no-store' });
  expect((await call('/api/s/shop-b/tasting-excerpts')).body).toEqual([]);
  expect(await call(placements, 'PUT', { show_on_listing: true, show_on_main_page: false }, 'publisher'))
    .toMatchObject({ body: { showOnListing: true, showOnMainPage: false } });
  expect(await call(listing)).toMatchObject({ body: [publicExcerpt], cache: 'no-store' });
  expect((await call('/api/products/lot-b/impressions')).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  await call(placements, 'PUT', { show_on_main_page: true }, 'publisher');

  const unpublish = await call('/api/products/lot-a/publication', 'PUT', { is_public: false }, 'publisher');
  expect(unpublish.status).toBe(200);
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  expect((await call(`${queue}?status=promoted`, 'GET', undefined, 'publisher')).body)
    .toEqual([expect.objectContaining({ showOnListing: true, showOnMainPage: true })]);
  const republish = await call('/api/products/lot-a/publication', 'PUT', { is_public: true }, 'publisher');
  expect(republish.status).toBe(200);
  expect((await call(listing)).body).toEqual([publicExcerpt]);
  expect((await call(main)).body).toEqual([publicExcerpt]);
  db.exec("UPDATE products SET shown_in_shop = 0 WHERE id = 'lot-a'");
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  db.exec("UPDATE products SET shown_in_shop = 1, status = 'Draft' WHERE id = 'lot-a'");
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  db.exec("UPDATE products SET shown_in_shop = 1, status = 'Sold Out' WHERE id = 'lot-a'");
  expect((await call(listing)).body).toEqual([publicExcerpt]);
  db.exec("UPDATE accounts SET public_enabled = 0 WHERE id = 'shop-a'");
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  db.exec("UPDATE accounts SET public_enabled = 1 WHERE id = 'shop-a'");

  await call(offerPath, 'DELETE', undefined, 'other');
  expect((await call(listing)).body).toEqual([publicExcerpt]);
  expect((await call(offerPath, 'DELETE', undefined, 'guest')).status).toBe(200);
  expect((await call(offerPath, 'DELETE', undefined, 'guest')).status).toBe(200);
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  expect((await call(placements, 'PUT', { show_on_listing: true }, 'publisher')).status).toBe(404);
  expect((await call('/api/tasting-journal', 'GET', undefined, 'guest')).body)
    .toEqual([expect.objectContaining({ id: 'journal-a', note: expect.stringContaining('Private journal paragraph') })]);
  const reoffered = await call(offerPath, 'PUT', offerData, 'guest');
  expect(reoffered.body.id).not.toBe(id);
  expect((await call(approve, 'POST', {}, 'publisher')).status).toBe(404);
  expect((await call(listing)).body).toEqual([]);
});

it('suppresses legacy impressions and rolls back a partially failed approval, then removes offers on journal deletion', async () => {
  const { db, call } = await setup();
  db.exec(`
    INSERT INTO tasting_note_candidates
      (id, account_id, journal_entry_id, note_key, product_id, author_user_id, source_text, status)
    VALUES ('legacy', 'shop-a', 'journal-a', 'sitting-a', 'lot-a', 'guest', 'Old private text', 'promoted');
    INSERT INTO product_impressions
      (id, account_id, product_id, candidate_id, text, attribution_name, published_by, show_on_listing, show_on_main_page)
    VALUES ('old-impression', 'shop-a', 'lot-a', 'legacy', 'Old private text', 'Old name', 'publisher', 1, 1);
  `);
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  expect((await call(`${queue}?status=promoted`, 'GET', undefined, 'publisher')).body).toEqual([]);
  const { body: { id } } = await call(offerPath, 'PUT', offerData, 'guest');

  db.exec(`
    CREATE TRIGGER fail_approval BEFORE UPDATE OF status ON tasting_note_candidates
    WHEN NEW.status = 'promoted' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END
  `);
  const approve = `${queue}/${id}/promote`;
  expect(await call(approve, 'POST', {}, 'publisher')).toMatchObject({ status: 500, body: { retryable: true } });
  expect((await call(offerPath, 'GET', undefined, 'guest')).body.status).toBe('starred');
  expect(db.sqlite.prepare('SELECT id FROM product_impressions').get()?.id).toBe('old-impression');
  db.exec('DROP TRIGGER fail_approval');
  const approved = await call(approve, 'POST', {}, 'publisher');
  expect(approved.status).toBe(201);
  expect(approved.body.id).not.toBe('old-impression');
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  await call(`/api/admin/tasting-impressions/${approved.body.id}/placements`, 'PUT', {
    show_on_listing: true, show_on_main_page: true,
  }, 'publisher');
  expect((await call('/api/tasting-journal/journal-a', 'DELETE', undefined, 'guest')).status).toBe(200);
  expect((await call(listing)).body).toEqual([]);
  expect((await call(main)).body).toEqual([]);
  expect(db.sqlite.prepare('SELECT id FROM tasting_note_candidates').get()).toBeUndefined();
  expect(db.sqlite.prepare('SELECT id FROM product_impressions').get()).toBeUndefined();
});

it('routes an offer for a publicly accessible lot to its owning shop even from a different journal account', async () => {
  const { db, call } = await setup('shop-b');
  const offer = await call(offerPath, 'PUT', offerData, 'guest');
  expect(offer).toMatchObject({ status: 200, body: { productId: 'lot-a' } });
  expect((await call(queue, 'GET', undefined, 'other')).body).toEqual([]);
  expect((await call(queue, 'GET', undefined, 'publisher')).body)
    .toEqual([expect.objectContaining({ id: offer.body.id })]);
  db.exec("UPDATE products SET is_public = 0 WHERE id = 'lot-a'");
  expect((await call(offerPath, 'GET', undefined, 'guest')).body.id).toBe(offer.body.id);
  await call(offerPath, 'DELETE', undefined, 'guest');
  expect((await call(queue, 'GET', undefined, 'publisher')).body).toEqual([]);
  expect((await call(offerPath, 'PUT', offerData, 'guest')).status).toBe(404);
});
