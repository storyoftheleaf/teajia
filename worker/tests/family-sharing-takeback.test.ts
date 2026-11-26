import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The K0 sharing audit (2026-11-26): what a person shared must be taken back
// when they say so, and a signed-out reader never gets a number score.
// Driven through worker.fetch against SQLite built from the migration ledger.

const SECRET = 'takeback-secret';
const SHOP = 'acc_teajia_bali';
const SLUG = 'teajia-bali';
const PASSWORD = 'correct horse';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

class Bucket {
  deleted: string[] = [];
  async get(key: string) {
    return this.deleted.includes(key) ? null : { body: 'jpeg', httpEtag: '"e"', writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/jpeg') };
  }
  async delete(keys: string | string[]) { this.deleted.push(...(Array.isArray(keys) ? keys : [keys])); }
}

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, accountSlug: SLUG, role: 'owner' });
  seedIdentity(db, { userId: 'platform-owner', accountId: 'acc-platform', platformRole: 'platform_owner' });
  const legacyHash = createHash('sha256').update(PASSWORD).digest('hex');
  for (const id of ['member-one', 'member-two']) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at)
      VALUES (?, ?, ?, ?, 'user', 0, '2026-11-01')`).run(id, `${id}@test.dev`, id, legacyHash);
  }
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams,
      tasting, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
    VALUES ('tea-a', ?, 'Oolong', 'Tea A', 'Tea A', 1, 1, 'Active', 100, ?, NULL, NULL, NULL, NULL)`).run(
    SHOP, JSON.stringify({ quality: 8, aromaRating: 4, finishRating: 3, rating: 7, aroma: ['orchid'], notes: ['Stone fruit'] }),
  );
  // Member one's journal for tea-a: two sittings, one of them carrying words from another journal row.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES ('journal-one', NULL, 'member-one@test.dev', 'tea-a', 'Tea A', 9, ?, ?)`).run(
    JSON.stringify({ rating: 9, verdict: 'love', tasting: {} }),
    JSON.stringify([
      { id: 's1', createdAt: '2026-11-10T08:00:00Z', tasting: { notes: ['Orchid on the lid'] } },
      { id: 's2', createdAt: '2026-11-18T08:00:00Z', tasting: { notes: [{ id: 'n2', text: 'Carried over from a guest', sourceJournalEntryId: 'journal-guest' }] } },
    ]),
  );
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
    VALUES ('mei', ?, 'member-one', 'Mei', 1, 'family', '[]')`).run(SHOP);
  db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
    VALUES ('journal-one', ?, 'tea-a', 'member-one', 'page', '2026-11-12 10:00:00', '2026-11-12 10:00:00')`).run(SHOP);
  // An offered quote the shop approved, on the listing and on Home.
  db.sqlite.prepare(`INSERT INTO tasting_note_candidates (id, account_id, journal_entry_id, note_key, product_id, author_user_id,
      source_text, status, attribution_name, offered_at, promoted_at, promoted_by, created_at, updated_at)
    VALUES ('cand-1', ?, 'journal-one', 'n1', 'tea-a', 'member-one', 'Orchid on the lid', 'promoted', 'Mei', '2026-11-12', '2026-11-13', 'owner', '2026-11-12', '2026-11-13')`).run(SHOP);
  db.sqlite.prepare(`INSERT INTO product_impressions (id, account_id, product_id, candidate_id, text, attribution_name, published_at, published_by,
      created_at, show_on_listing, show_on_main_page)
    VALUES ('imp-1', ?, 'tea-a', 'cand-1', 'Orchid on the lid', 'Mei', '2026-11-13', 'owner', '2026-11-13', 1, 1)`).run(SHOP);
  const photo = (id: string, shopUse = 'none') => db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id,
      journal_entry_id, full_key, small_key, full_bytes, small_bytes, full_width, full_height, small_width, small_height,
      share_state, offered_at, shop_use, created_at, updated_at, shape)
    VALUES (?, ?, 'tea-a', 'member-one', 'journal-one', ?, ?, 10, 5, 2000, 1500, 480, 360, 'offered', '2026-11-12', ?, '2026-11-12', '2026-11-12', 'square')`)
    .run(id, SHOP, `family-photos/${id}/full.jpg`, `family-photos/${id}/small.jpg`, shopUse);
  photo('photo-1');
  photo('photo-2', 'placed');
  db.sqlite.prepare(`INSERT INTO member_tea_covers (author_user_id, product_id, account_id, photograph_id, updated_at)
    VALUES ('member-one', 'tea-a', ?, 'photo-1', '2026-11-12')`).run(SHOP);
  // A network review with a score.
  db.sqlite.prepare(`INSERT INTO tea_reviews (id, tea_key, product_id, product_account_id, author_user_id, author_account_id,
      visibility, rating, notes, tasting, status)
    VALUES ('review-1', 'tea-a-key', 'tea-a', ?, 'owner', ?, 'network', 8, 'Bright and long', ?, 'submitted')`).run(
    SHOP, SHOP, JSON.stringify({ quality: 8, aroma: ['orchid'] }),
  );
  const bucket = new Bucket();
  const env = { DB: db as any, JWT_SECRET: SECRET, MEDIA_BUCKET: bucket as any, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } };
  return { db, env, bucket };
}

type Who = { userId: string; account?: string; platformRole?: string | null } | null;
async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null,
      platform_role: who.platformRole ?? null, session_version: 0,
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}
const read = async (env: any, who: Who, path: string) => {
  const response = await call(env, who, path);
  expect(response.status).toBe(200);
  return await response.json() as any;
};

const MEMBER = { userId: 'member-one' };
const OWNER = { userId: 'owner', account: SHOP };

describe('a signed-out reader never gets a number score', () => {
  it('reads the shop tasting on a tea without its scores, on the listing and the detail', async () => {
    const { env } = setup();
    const detail = await read(env, null, `/api/s/${SLUG}/products/tea-a`);
    const list = (await read(env, null, `/api/s/${SLUG}/products`)).find((p: any) => p.id === 'tea-a');
    const legacy = await read(env, null, '/api/products/public/tea-a');
    for (const product of [detail, list, legacy]) {
      expect(product.tasting).toEqual({ aroma: ['orchid'], notes: ['Stone fruit'] });
    }
  });

  it('reads network reviews without the score; a signed-in reader still has it', async () => {
    const { env } = setup();
    const [review] = await read(env, null, '/api/tea-reviews?product_id=tea-a');
    expect(review).toMatchObject({ id: 'review-1', notes: 'Bright and long', tasting: { aroma: ['orchid'] } });
    expect(review).not.toHaveProperty('rating');
    expect(review.tasting).not.toHaveProperty('quality');
    const [own] = await read(env, OWNER, '/api/tea-reviews?product_id=tea-a');
    expect(own).toMatchObject({ id: 'review-1', rating: 8, tasting: { quality: 8 } });
  });
});

describe('a person page shows only the words written in that sitting', () => {
  it('leaves out a note carried over from another journal row', async () => {
    const { env } = setup();
    const page = await read(env, null, '/api/people/mei');
    const words = page.tastings.find((t: any) => t.product_id === 'tea-a').words.map((w: any) => w.text);
    expect(words).toEqual(['Orchid on the lid']);
  });

  it('Keep private on a later sitting takes the tea off the page', async () => {
    const { env } = setup();
    expect((await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'private' } })).status).toBe(200);
    const page = await read(env, null, '/api/people/mei');
    expect(page.tastings.find((t: any) => t.product_id === 'tea-a')?.words ?? []).toEqual([]);
  });
});

describe('setting a shared tasting to private', () => {
  it('takes its approved quotes off Home and the tea listing in the same step', async () => {
    const { env, db } = setup();
    expect(await read(env, null, '/api/products/tea-a/impressions')).toHaveLength(1);
    expect(await read(env, null, `/api/s/${SLUG}/tasting-excerpts`)).toHaveLength(1);
    expect((await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'private' } })).status).toBe(200);
    expect(await read(env, null, '/api/products/tea-a/impressions')).toEqual([]);
    expect(await read(env, null, `/api/s/${SLUG}/tasting-excerpts`)).toEqual([]);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM tasting_note_candidates WHERE journal_entry_id = 'journal-one'`).get()).toEqual({ n: 0 });
  });

  it('leaves the quotes alone when the tasting stays on the page', async () => {
    const { env } = setup();
    await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    expect(await read(env, null, '/api/products/tea-a/impressions')).toHaveLength(1);
  });
});

describe('Remove from my page on a photograph', () => {
  it('cannot be placed or made the lead afterwards', async () => {
    const { env } = setup();
    expect((await call(env, MEMBER, '/api/family/photographs/photo-1/remove', { method: 'POST' })).status).toBe(200);
    for (const action of ['lead', 'place']) {
      const refused = await call(env, OWNER, `/api/admin/family/photographs/photo-1/${action}`, { method: 'POST' });
      expect(refused.status).toBe(409);
      expect(((await refused.json()) as any).code).toBe('removed_by_author');
    }
    const tea = await read(env, null, '/api/family/teas/tea-a/photographs');
    expect([tea.lead?.id, ...tea.placed.map((p: any) => p.id), ...tea.family.map((p: any) => p.id)]).not.toContain('photo-1');
  });

  it('takes a placed photograph off the tea page', async () => {
    const { env, db } = setup();
    expect((await read(env, null, '/api/family/teas/tea-a/photographs')).placed.map((p: any) => p.id)).toEqual(['photo-2']);
    expect((await call(env, MEMBER, '/api/family/photographs/photo-2/remove', { method: 'POST' })).status).toBe(200);
    const tea = await read(env, null, '/api/family/teas/tea-a/photographs');
    expect(tea.placed).toEqual([]);
    expect(tea.family.map((p: any) => p.id)).toEqual(['photo-1']);
    expect(db.sqlite.prepare(`SELECT shop_use FROM member_photographs WHERE id = 'photo-2'`).get()).toEqual({ shop_use: 'none' });
    // The unsigned file address stops answering too.
    expect((await call(env, null, '/api/media/family-photos/photo-2/small.jpg')).status).toBe(404);
  });
});

describe('deleting an account with things on the family pages', () => {
  async function expectNothingLeft(env: any, db: SqliteD1, bucket: Bucket) {
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = 'member-one'`).get()).toEqual({ n: 0 });
    for (const table of ['member_tasting_shares', 'member_photographs', 'member_tea_covers', 'tasting_note_candidates']) {
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE author_user_id = 'member-one'`).get()).toEqual({ n: 0 });
    }
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM product_impressions`).get()).toEqual({ n: 0 });
    expect((await call(env, null, '/api/people/mei')).status).toBe(404);
    expect(db.sqlite.prepare(`SELECT user_id, is_published FROM contributors WHERE id = 'mei'`).get()).toEqual({ user_id: null, is_published: 0 });
    expect(await read(env, null, '/api/products/tea-a/impressions')).toEqual([]);
    const tea = await read(env, null, '/api/family/teas/tea-a/photographs');
    expect(tea).toMatchObject({ lead: null, placed: [], family: [] });
    expect(bucket.deleted.sort()).toEqual([
      'family-photos/photo-1/full.jpg', 'family-photos/photo-1/small.jpg', 'family-photos/photo-2/full.jpg', 'family-photos/photo-2/small.jpg',
    ]);
  }

  it('succeeds when the person deletes themselves, and nothing they shared stays public', async () => {
    const { env, db, bucket } = setup();
    const response = await call(env, MEMBER, '/api/auth/account', { method: 'DELETE', body: { password: PASSWORD } });
    expect(response.status).toBe(200);
    await expectNothingLeft(env, db, bucket);
  });

  it('succeeds when the platform owner deletes them', async () => {
    const { env, db, bucket } = setup();
    const response = await call(env, { userId: 'platform-owner', account: 'acc-platform', platformRole: 'platform_owner' },
      '/api/admin/users/member-one', { method: 'DELETE' });
    expect(response.status).toBe(200);
    await expectNothingLeft(env, db, bucket);
  });

  it('keeps the shop decisions a deleted staff member made, without their name', async () => {
    const { env, db } = setup();
    seedIdentity(db, { userId: 'staff-one', accountId: SHOP, accountSlug: SLUG, role: 'staff' });
    db.sqlite.exec(`UPDATE tasting_note_candidates SET promoted_by = 'staff-one';
      UPDATE member_photographs SET shop_decided_by = 'staff-one' WHERE id = 'photo-2';
      UPDATE product_impressions SET published_by = 'owner';`);
    const response = await call(env, { userId: 'platform-owner', account: 'acc-platform', platformRole: 'platform_owner' },
      '/api/admin/users/staff-one', { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT status, promoted_by FROM tasting_note_candidates WHERE id = 'cand-1'`).get()).toEqual({ status: 'promoted', promoted_by: null });
    expect(db.sqlite.prepare(`SELECT shop_use, shop_decided_by FROM member_photographs WHERE id = 'photo-2'`).get()).toEqual({ shop_use: 'placed', shop_decided_by: null });
  });
});
