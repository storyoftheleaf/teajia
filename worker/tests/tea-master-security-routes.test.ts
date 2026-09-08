import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'tea-master-security-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string, options: {
  method?: string;
  body?: unknown;
  userId?: string;
  accountId?: string;
  platformRole?: 'platform_owner' | 'platform_admin' | null;
} = {}) {
  const userId = options.userId ?? 'user-one';
  const accountId = options.accountId ?? 'acc-one';
  const token = await signedToken(SECRET, {
    sub: userId,
    email: `${userId}@test.dev`,
    name: userId,
    active_account_id: accountId,
    platform_role: options.platformRole ?? null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function seedPublicTea(db: SqliteD1, options: {
  profileId: string;
  productId: string;
  accountId?: string;
  accountSlug?: string;
  publicEnabled?: boolean;
  teaStatus?: string;
  listingPublic?: boolean;
}) {
  const accountId = options.accountId ?? 'acc-one';
  const accountSlug = options.accountSlug ?? accountId;
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled)
    VALUES (?, ?, ?, 'active', ?)`).run(accountId, accountSlug, accountSlug, options.publicEnabled === false ? 0 : 1);
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, product_name, type, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, 'Oolong', 'Active', ?, ?, 100)`).run(
      options.productId, accountId, options.productId, options.listingPublic === false ? 0 : 1, options.listingPublic === false ? 0 : 1,
    );
  db.sqlite.prepare(`INSERT INTO tea_profiles
    (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      options.profileId, options.profileId, accountId, accountId, options.profileId,
      options.teaStatus ?? 'published', options.teaStatus === 'draft' ? 0 : 1,
    );
  db.sqlite.prepare(`INSERT INTO product_listings
    (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, ?, ?, ?, 'active', ?, ?, 100)`).run(
      `listing-${options.productId}`, accountId, options.profileId, options.productId,
      options.listingPublic === false ? 0 : 1, options.listingPublic === false ? 0 : 1,
    );
}

describe('Tea Master route security', () => {
  it('keeps pending self edits out of ordinary admin saves and supports bounded request-changes notes', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Live beginning',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_profile_drafts
      (contributor_id, payload, approval_status, submitted_by)
      VALUES ('mei-lin','{"beginnings":"Pending beginning"}','pending','user-one')`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id)
      VALUES ('mei-lin','acc-one')`).run();

    const bypass = await call(db, '/api/admin/contributors/mei-lin', {
      method: 'PUT', body: { beginnings: 'Pending beginning' },
    });
    expect(bypass.status).toBe(409);
    expect(await bypass.json()).toMatchObject({ code: 'profile_review_required' });
    expect(db.sqlite.prepare(`SELECT beginnings FROM contributors WHERE id='mei-lin'`).get())
      .toEqual({ beginnings: 'Live beginning' });

    const requested = await call(db, '/api/admin/contributors/mei-lin/request-changes', {
      method: 'POST', body: { note: 'Please clarify when this began.' },
    });
    expect(requested.status).toBe(200);
    expect((await requested.json() as any).contributor).toMatchObject({
      approval_state: 'changes_requested',
      reviewer_note: 'Please clarify when this began.',
      has_pending_draft: true,
    });
    const self = await call(db, '/api/me/public-profile');
    expect((await self.json() as any).contributor).toMatchObject({
      approval_state: 'changes_requested', reviewer_note: 'Please clarify when this began.',
    });

    const oversized = await call(db, '/api/admin/contributors/mei-lin/request-changes', {
      method: 'POST', body: { note: 'x'.repeat(1001) },
    });
    expect(oversized.status).toBe(400);
  });

  it('lets a linked person manage their global profile after losing the last account membership', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Live beginning',1)`).run();
    db.sqlite.prepare(`DELETE FROM account_members WHERE user_id='user-one'`).run();

    const response = await call(db, '/api/me/public-profile');
    expect(response.status).toBe(200);
    expect((await response.json() as any).contributor).toMatchObject({ id: 'mei-lin' });
    expect((await call(db, '/api/me/public-profile/unpublish', { method: 'POST' })).status).toBe(200);
    const unpublished = await call(db, '/api/me/public-profile');
    expect((await unpublished.json() as any).contributor).toMatchObject({
      publication_state: 'unpublished', approval_state: 'approved', is_published: 0,
    });
  });

  it('unpublishes the live profile without approving or discarding its pending draft', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Live beginning',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_profile_drafts
      (contributor_id, payload, approval_status, submitted_by, reviewer_note)
      VALUES ('mei-lin','{"beginnings":"Pending beginning"}','changes_requested','user-one','Clarify this')`).run();

    expect((await call(db, '/api/me/public-profile/unpublish', { method: 'POST' })).status).toBe(200);
    expect(db.sqlite.prepare(`SELECT is_published, unpublished_at FROM contributors WHERE id='mei-lin'`).get())
      .toMatchObject({ is_published: 0, unpublished_at: expect.any(String) });
    expect(db.sqlite.prepare(`SELECT payload, approval_status, reviewer_note FROM contributor_profile_drafts WHERE contributor_id='mei-lin'`).get())
      .toEqual({ payload: '{"beginnings":"Pending beginning"}', approval_status: 'changes_requested', reviewer_note: 'Clarify this' });
    expect((await (await call(db, '/api/me/public-profile')).json() as any).contributor).toMatchObject({
      publication_state: 'awaiting_approval', approval_state: 'changes_requested',
      has_pending_draft: true, beginnings: 'Pending beginning',
    });
  });

  it('stores self-uploaded profile media in the pending draft without changing the live profile', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, avatar_url, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','https://media.example/live.jpg',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_profile_drafts
      (contributor_id, payload, approval_status, submitted_by)
      VALUES ('mei-lin','{"now_text":"Pending words"}','pending','user-one')`).run();
    const token = await signedToken(SECRET, {
      sub: 'user-one', email: 'user-one@test.dev', name: 'User One', active_account_id: 'acc-one', platform_role: null,
    });
    const form = new FormData();
    form.set('slot', 'avatar');
    form.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'avatar.jpg', { type: 'image/jpeg' }));
    const response = await worker.fetch(new Request('https://worker.test/api/me/public-profile/image', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'acc-one' }, body: form,
    }), {
      DB: db as any, JWT_SECRET: SECRET,
      MEDIA_BUCKET: { put: async () => ({}) } as any,
      PROVIDER_LIMITER: { limit: async () => ({ success: true }) } as any,
    } as any);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ slot: 'avatar', approval_state: 'pending' });
    expect(db.sqlite.prepare(`SELECT avatar_url FROM contributors WHERE id='mei-lin'`).get())
      .toEqual({ avatar_url: 'https://media.example/live.jpg' });
    const draft = db.sqlite.prepare(`SELECT payload FROM contributor_profile_drafts WHERE contributor_id='mei-lin'`).get() as any;
    expect(JSON.parse(draft.payload)).toMatchObject({ now_text: 'Pending words' });
    expect(JSON.parse(draft.payload).avatar_url).toMatch(/^https:\/\/media\.teajia\.co\/people\/mei-lin\/drafts\/[a-f0-9-]+-avatar\.jpg\?v=/);
  });

  it('keeps self edits in a durable draft and requires owner publication to change live public fields', async () => {
    const db = database();
    seedIdentity(db);
    seedIdentity(db, { userId: 'platform-steward', accountId: 'platform-editorial', accountSlug: 'platform-editorial' });
    db.sqlite.prepare(`UPDATE accounts SET is_platform_owner=1 WHERE id='platform-editorial'`).run();

    const created = await call(db, '/api/me/public-profile', {
      method: 'PUT', body: { id: 'mei-lin', display_name: 'Mei Lin', beginnings: 'First draft.' },
    });
    expect(created.status).toBe(201);
    expect(db.sqlite.prepare('SELECT account_id FROM contributors WHERE id = ?').get('mei-lin'))
      .toEqual({ account_id: 'platform-editorial' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM contributor_accounts WHERE contributor_id = ?').get('mei-lin'))
      .toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT approval_status FROM contributor_profile_drafts WHERE contributor_id = ?').get('mei-lin')).toEqual({ approval_status: 'pending' });

    const stewardRequest = { userId: 'platform-steward', accountId: 'platform-editorial' } as const;
    expect((await call(db, '/api/admin/contributors/mei-lin/publish', { method: 'POST', ...stewardRequest })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT beginnings, is_published FROM contributors WHERE id = ?').get('mei-lin')).toEqual({ beginnings: 'First draft.', is_published: 1 });

    db.sqlite.prepare(`UPDATE contributors SET beginnings = 'Editorial correction.' WHERE id = 'mei-lin'`).run();
    const selfAfterEditorialEdit = await call(db, '/api/me/public-profile');
    expect(await selfAfterEditorialEdit.json()).toMatchObject({ contributor: { beginnings: 'Editorial correction.' } });

    expect((await call(db, '/api/me/public-profile', {
      method: 'PUT', body: { display_name: 'Mei Lin revised', now_text: 'Pending revision.' },
    })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT display_name, beginnings, now_text FROM contributors WHERE id = ?').get('mei-lin')).toEqual({ display_name: 'Mei Lin', beginnings: 'Editorial correction.', now_text: null });

    const adminList = await call(db, '/api/admin/contributors', stewardRequest);
    const adminPreview = (await adminList.json() as any).contributors[0];
    expect(adminPreview).toMatchObject({
      id: 'mei-lin',
      display_name: 'Mei Lin revised',
      beginnings: 'Editorial correction.',
      now_text: 'Pending revision.',
      is_published: 1,
      has_pending_draft: true,
      approval_state: 'pending',
      draft_diff: {
        changed_fields: ['display_name', 'now_text'],
        live: { display_name: 'Mei Lin', now_text: null },
        pending: { display_name: 'Mei Lin revised', now_text: 'Pending revision.' },
      },
    });
    expect(adminPreview).not.toHaveProperty('profile_draft_payload');

    const adminDetail = await call(db, '/api/admin/contributors/mei-lin', stewardRequest);
    expect((await adminDetail.json() as any).contributor).toMatchObject(adminPreview);

    seedIdentity(db, { accountId: 'acc-unrelated', accountSlug: 'unrelated' });
    const unrelatedList = await call(db, '/api/admin/contributors', { accountId: 'acc-unrelated' });
    expect((await unrelatedList.json() as any).contributors).toEqual([]);
    expect((await call(db, '/api/admin/contributors/mei-lin', { accountId: 'acc-unrelated' })).status).toBe(404);

    const publicBeforeApproval = await worker.fetch(new Request('https://worker.test/api/people/mei-lin'), { DB: db as any } as any);
    expect(await publicBeforeApproval.json()).toMatchObject({ display_name: 'Mei Lin', beginnings: 'Editorial correction.', now_text: null });
    const promoted = await call(db, '/api/admin/contributors/mei-lin/publish', { method: 'POST', ...stewardRequest });
    expect(promoted.status).toBe(200);
    const promotedContributor = (await promoted.json() as any).contributor;
    expect({
      display_name: promotedContributor.display_name,
      beginnings: promotedContributor.beginnings,
      now_text: promotedContributor.now_text,
    }).toEqual({
      display_name: adminPreview.display_name,
      beginnings: adminPreview.beginnings,
      now_text: adminPreview.now_text,
    });
    expect(db.sqlite.prepare('SELECT display_name, beginnings, now_text FROM contributors WHERE id = ?').get('mei-lin')).toEqual({ display_name: 'Mei Lin revised', beginnings: 'Editorial correction.', now_text: 'Pending revision.' });

    const approvedDetail = await call(db, '/api/admin/contributors/mei-lin', stewardRequest);
    expect((await approvedDetail.json() as any).contributor).toMatchObject({
      display_name: 'Mei Lin revised',
      has_pending_draft: false,
      approval_state: 'approved',
      draft_diff: null,
    });
  });

  it('fails first-time profile creation clearly when no active platform editorial steward exists', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare('UPDATE accounts SET is_platform_owner=0').run();
    const response = await call(db, '/api/me/public-profile', {
      method: 'PUT', body: { id: 'mei-lin', display_name: 'Mei Lin' },
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'editorial_steward_unavailable' });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM contributors`).get()).toEqual({ count: 0 });
  });

  it('rejects hidden teas and mismatched favorite sources', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name) VALUES ('mei-lin','acc-one','user-one','Mei Lin')`).run();
    seedPublicTea(db, { profileId: 'public-tea', productId: 'public-product' });
    seedPublicTea(db, { profileId: 'hidden-tea', productId: 'hidden-product', teaStatus: 'draft', listingPublic: false });

    expect((await call(db, '/api/me/profile/favorites', {
      method: 'POST', body: { tea_profile_id: 'hidden-tea', is_public: false },
    })).status).toBe(404);
    expect((await call(db, '/api/me/profile/favorites', {
      method: 'POST', body: {
        tea_profile_id: 'public-tea', source_account_id: 'acc-one', source_product_id: 'hidden-product', is_public: true,
      },
    })).status).toBe(400);
    expect((await call(db, '/api/me/profile/favorites', {
      method: 'POST', body: {
        tea_profile_id: 'public-tea', source_account_id: 'acc-one', source_product_id: 'public-product', is_public: true,
      },
    })).status).toBe(201);
  });

  it('falls back to an eligible public listing, omits unrepresented teas, and renumbers positions', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Beginnings',1)`).run();
    seedPublicTea(db, { profileId: 'tea-a', productId: 'product-a' });
    seedPublicTea(db, { profileId: 'tea-b', productId: 'product-b' });
    db.sqlite.prepare(`INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible)
      VALUES ('tea-no-listing','tea-no-listing','acc-one','acc-one','No listing','published',1)`).run();
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public)
      VALUES ('mei-lin','tea-a','A',2,1),('mei-lin','tea-b','B',9,1),('mei-lin','tea-no-listing','hidden',12,1)`).run();

    const response = await worker.fetch(new Request('https://worker.test/api/public/people/mei-lin/favorites'), { DB: db as any } as any);
    const body = await response.json() as any;
    expect(body.favorites.map((favorite: any) => [favorite.tea_profile_id, favorite.position])).toEqual([['tea-a', 0], ['tea-b', 1]]);
  });

  it('requires favorite reorders to contain the complete current set', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin')`).run();
    seedPublicTea(db, { profileId: 'tea-a', productId: 'product-a' });
    seedPublicTea(db, { profileId: 'tea-b', productId: 'product-b' });
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, position)
      VALUES ('mei-lin','tea-a',0),('mei-lin','tea-b',1)`).run();

    const partial = await call(db, '/api/me/profile/favorites/order', {
      method: 'PUT', body: { tea_profile_ids: ['tea-b'] },
    });
    expect(partial.status).toBe(409);
    expect(await partial.json()).toMatchObject({ code: 'favorite_order_stale' });
    expect(db.sqlite.prepare(`SELECT tea_profile_id, position FROM profile_favorites
      WHERE contributor_id='mei-lin' ORDER BY position`).all()).toEqual([
      { tea_profile_id: 'tea-a', position: 0 }, { tea_profile_id: 'tea-b', position: 1 },
    ]);
  });

  it('returns eligible favorite provenance and accepts a public listing from another account', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin')`).run();
    seedPublicTea(db, {
      profileId: 'network-tea', productId: 'network-product',
      accountId: 'network-account', accountSlug: 'network-shop',
    });

    const available = await call(db, '/api/me/profile/favorites');
    const tea = (await available.json() as any).available_teas.find((row: any) => row.id === 'network-tea');
    expect(tea).toMatchObject({
      source_account_id: 'network-account',
      source_listing_id: 'listing-network-product',
      source_product_id: 'network-product',
      public_path: '/shop/product/network-product?store=network-shop',
    });
    const created = await call(db, '/api/me/profile/favorites', {
      method: 'POST', body: {
        tea_profile_id: 'network-tea', source_account_id: tea.source_account_id,
        source_listing_id: tea.source_listing_id, is_public: true,
      },
    });
    expect(created.status).toBe(201);
  });

  it('omits favorite representations when the underlying product is no longer public', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin',1)`).run();
    seedPublicTea(db, { profileId: 'hidden-product-tea', productId: 'hidden-product' });
    db.sqlite.prepare(`INSERT INTO profile_favorites
      (contributor_id, tea_profile_id, source_account_id, source_product_id, position, is_public)
      VALUES ('mei-lin','hidden-product-tea','acc-one','hidden-product',0,1)`).run();
    db.sqlite.prepare(`UPDATE products SET is_public=0, shown_in_shop=0 WHERE id='hidden-product'`).run();

    const mine = await call(db, '/api/me/profile/favorites');
    expect((await mine.json() as any).available_teas).toEqual([]);
    const publicFavorites = await worker.fetch(
      new Request('https://worker.test/api/public/people/mei-lin/favorites'),
      { DB: db as any } as any,
    );
    expect((await publicFavorites.json() as any).favorites).toEqual([]);
    expect((await call(db, '/api/me/profile/favorites', {
      method: 'POST', body: {
        tea_profile_id: 'hidden-product-tea', source_account_id: 'acc-one',
        source_listing_id: 'listing-hidden-product', is_public: true,
      },
    })).status).toBe(404);
  });

  it('builds public Tea Master selection only from active public associated master accounts', async () => {
    const db = database(); seedIdentity(db);
    seedIdentity(db, { accountId: 'master-rayi', accountSlug: 'rayi-selection' });
    seedIdentity(db, { accountId: 'unrelated', accountSlug: 'unrelated' });
    db.sqlite.prepare(`UPDATE accounts SET kind='master' WHERE id='master-rayi'`).run();
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('rayi','acc-one','user-one','Rayi','Beginnings',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, is_host)
      VALUES ('rayi','master-rayi',1)`).run();
    seedPublicTea(db, { profileId: 'rayi-tea', productId: 'rayi-product', accountId: 'master-rayi', accountSlug: 'rayi-selection' });
    seedPublicTea(db, { profileId: 'wrong-tea', productId: 'wrong-product', accountId: 'unrelated', accountSlug: 'unrelated' });
    db.sqlite.prepare(`UPDATE products SET sourced_by='rayi' WHERE id='wrong-product'`).run();

    const response = await worker.fetch(new Request('https://worker.test/api/people/rayi'), { DB: db as any } as any);
    const products = (await response.json() as any).products;
    expect(products.map((product: any) => product.id)).toEqual(['rayi-product']);
    expect(products[0].public_path).toBe('/shop/product/rayi-product?store=rayi-selection');
  });

  it('transfers a Tea Master account host atomically and keeps compatibility mirrors synchronized', async () => {
    const db = database();
    seedIdentity(db, { userId: 'platform-admin', platformRole: 'platform_admin' });
    seedIdentity(db, { accountId: 'master-rayi', accountSlug: 'rayi-selection' });
    db.sqlite.prepare(`UPDATE accounts SET kind='master' WHERE id='master-rayi'`).run();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name)
      VALUES ('rayi','acc-one','Rayi'),('barry','acc-one','Barry')`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, is_host)
      VALUES ('rayi','master-rayi',1)`).run();
    db.sqlite.prepare(`UPDATE accounts SET host_contributor_id='rayi' WHERE id='master-rayi'`).run();
    db.sqlite.prepare(`UPDATE contributors SET face_of_account_id='master-rayi' WHERE id='rayi'`).run();

    const response = await call(db, '/api/admin/contributors/barry/accounts', {
      method: 'PUT', userId: 'platform-admin', platformRole: 'platform_admin',
      body: { accounts: [{ account_id: 'master-rayi', public_role: 'Tea Master', is_host: true, display_order: 0 }] },
    });
    expect(response.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT contributor_id FROM contributor_accounts
      WHERE account_id='master-rayi' AND is_host=1`).get()).toEqual({ contributor_id: 'barry' });
    expect(db.sqlite.prepare(`SELECT host_contributor_id FROM accounts WHERE id='master-rayi'`).get())
      .toEqual({ host_contributor_id: 'barry' });
    expect(db.sqlite.prepare(`SELECT id, face_of_account_id FROM contributors
      WHERE id IN ('rayi','barry') ORDER BY id`).all()).toEqual([
      { id: 'barry', face_of_account_id: 'master-rayi' }, { id: 'rayi', face_of_account_id: null },
    ]);
  });

  it('accepts account payment context and rejects non-decimal or unsupported display context', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Beginnings',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('mei-lin','acc-one')`).run();
    db.sqlite.prepare(`INSERT INTO payment_methods
      (id, contributor_id, account_id, method_type, label, recipient_name, is_published)
      VALUES ('pay-one','mei-lin','acc-one','bank_transfer','Bank','Mei Lin',1)`).run();

    const response = await worker.fetch(new Request('https://worker.test/api/public/people/mei-lin/payment-methods?account=acc-one&amount=1e3&currency=ZZZ&reference=%3Cbad%3E'), { DB: db as any } as any);
    const body = await response.json() as any;
    expect(body.store).toMatchObject({ slug: 'acc-one' });
    expect(body.context).toMatchObject({ amount: null, currency: null, reference: null });
    expect(body.context.errors).toHaveLength(3);
  });

  it('exposes privacy-safe payment availability and eligible public account choices', async () => {
    const db = database(); seedIdentity(db);
    seedIdentity(db, { accountId: 'master-mei', accountSlug: 'mei-selection' });
    db.sqlite.prepare(`UPDATE accounts SET kind='master' WHERE id='master-mei'`).run();
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin','Beginnings',1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, is_host)
      VALUES ('mei-lin','master-mei',1)`).run();
    db.sqlite.prepare(`INSERT INTO payment_methods
      (id, contributor_id, account_id, method_type, label, recipient_name, is_published)
      VALUES ('pay-one','mei-lin','master-mei','bank_transfer','Bank','Mei Lin',1)`).run();

    const profile = await worker.fetch(new Request('https://worker.test/api/people/mei-lin'), { DB: db as any } as any);
    expect(await profile.json()).toMatchObject({
      has_payment_methods: true,
      payment_accounts: [{ slug: 'mei-selection', name: 'mei-selection' }],
    });
    const payment = await worker.fetch(new Request('https://worker.test/api/public/people/mei-lin/payment-methods'), { DB: db as any } as any);
    const body = await payment.json() as any;
    expect(body).toMatchObject({
      has_any_method: true,
      available_accounts: [{ slug: 'mei-selection', name: 'mei-selection' }],
    });
    expect(body.available_accounts[0]).not.toHaveProperty('method_count');
  });

  it('validates payment fields and records append-only redacted audit events', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin')`).run();

    const invalid = await call(db, '/api/me/profile/payment-methods', {
      method: 'POST', body: { method_type: 'bank_transfer', label: 'x'.repeat(81), recipient_name: 'Mei Lin' },
    });
    expect(invalid.status).toBe(400);

    const created = await call(db, '/api/me/profile/payment-methods', {
      method: 'POST', body: {
        method_type: 'bank_transfer', label: 'Bank', recipient_name: 'Mei Lin',
        account_identifier: 'SECRET-ACCOUNT', is_published: true,
      },
    });
    expect(created.status).toBe(201);
    const methodId = (await created.json() as any).payment_method.id;
    await call(db, `/api/me/profile/payment-methods/${methodId}`, {
      method: 'PUT', body: { label: 'Primary bank' },
    });
    await call(db, `/api/me/profile/payment-methods/${methodId}`, { method: 'DELETE' });
    const events = db.sqlite.prepare(`SELECT action, payment_method_id, changed_fields, redacted_snapshot
      FROM payment_method_audit_events ORDER BY rowid`).all() as any[];
    expect(events.map(event => event.action)).toEqual(['created', 'updated', 'deleted']);
    expect(events.every(event => !String(event.redacted_snapshot).includes('SECRET-ACCOUNT'))).toBe(true);
    expect(events[1].changed_fields).toContain('label');
  });

  it('exposes Wisdom public state so hidden nodes can be gated before rendering', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO wisdom_node_overrides (node_type, node_id, public_state, reviewed_by)
      VALUES ('cultivar','rou-gui','hidden','user-one')`).run();
    const response = await worker.fetch(
      new Request('https://worker.test/api/public/wisdom/cultivar/rou-gui/state'),
      { DB: db as any } as any,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ node_type: 'cultivar', node_id: 'rou-gui', public_state: 'hidden', is_public: false });

    const states = await worker.fetch(
      new Request('https://worker.test/api/public/wisdom/states'),
      { DB: db as any } as any,
    );
    expect(states.status).toBe(200);
    expect(await states.json()).toEqual({
      states: [{ node_type: 'cultivar', node_id: 'rou-gui', public_state: 'hidden', is_public: false }],
    });
  });

  it('scopes association reads for a non-steward account owner', async () => {
    const db = database();
    seedIdentity(db, { accountId: 'acc-steward', accountSlug: 'steward' });
    seedIdentity(db, { accountId: 'acc-other', accountSlug: 'other' });
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name)
      VALUES ('mei-lin','acc-steward','user-one','Mei Lin')`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role)
      VALUES ('mei-lin','acc-steward','Steward'),('mei-lin','acc-other','Guest')`).run();

    const response = await call(db, '/api/admin/contributors/mei-lin/accounts', { accountId: 'acc-other' });
    expect(response.status).toBe(200);
    expect((await response.json() as any).accounts.map((row: any) => row.account_id)).toEqual(['acc-other']);

    db.sqlite.prepare(`INSERT INTO contributor_profile_drafts
      (contributor_id, payload, approval_status, submitted_by)
      VALUES ('mei-lin','{"now_text":"Pending"}','pending','user-one')`).run();
    expect((await call(db, '/api/admin/contributors/mei-lin/request-changes', {
      method: 'POST', accountId: 'acc-other', body: { note: 'Guest store cannot review global identity.' },
    })).status).toBe(404);
  });

  it('strictly validates canonical Tea Master association roles, host flags, and order', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name)
      VALUES ('mei-lin','acc-one','Mei Lin')`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id)
      VALUES ('mei-lin','acc-one')`).run();
    const invalid = await call(db, '/api/admin/contributors/mei-lin/accounts', {
      method: 'PUT',
      body: { accounts: [{ account_id: 'acc-one', public_role: 'x'.repeat(81), is_host: 'false', display_order: -2 }] },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'association_invalid' });
  });

  it('requires stock access and reports legacy incoming plus sitting count/latest entry', async () => {
    const db = database();
    seedIdentity(db, { role: 'viewer', bundles: [] });
    db.sqlite.prepare(`INSERT INTO products
      (id, account_id, product_name, type, status, stock_grams, in_transit, in_transit_grams)
      VALUES ('tea-one','acc-one','Tea One','Oolong','Active',0,1,75)`).run();
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal
      (id, account_id, user_id, product_id, tastings, created_at)
      VALUES ('journal-one','acc-one','user-one','tea-one','[{"id":1},{"id":2}]','2026-08-10T10:00:00Z')`).run();
    expect((await call(db, '/api/inventory/summaries')).status).toBe(403);

    db.sqlite.prepare(`UPDATE account_members SET role='owner' WHERE user_id='user-one' AND account_id='acc-one'`).run();
    const response = await call(db, '/api/inventory/summaries');
    const summary = (await response.json() as any).summaries[0];
    expect(summary).toMatchObject({ incoming_quantity: 75, personal_tasting_count: 2, latest_tasting_entry_id: 'journal-one' });
  });

  it('rejects a newly created incoming-only tea from every public projection', async () => {
    const db = database(); seedIdentity(db);
    const response = await call(db, '/api/products', {
      method: 'POST',
      body: {
        product_name: 'Incoming tea', cost_amount: 0, cost_currency: 'USD', type: 'Oolong', stock_grams: 0,
        in_transit: true, in_transit_grams: 100, is_public: true, shown_in_shop: true,
      },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'incoming_stock_not_publishable' });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM products WHERE product_name='Incoming tea'`).get())
      .toEqual({ count: 0 });
  });

  it('defaults newly created incoming-only tea to private inventory when publication was not requested', async () => {
    const db = database(); seedIdentity(db);
    const response = await call(db, '/api/products', {
      method: 'POST',
      body: {
        product_name: 'Private incoming tea', cost_amount: 0, cost_currency: 'USD', type: 'Oolong', stock_grams: 0,
        in_transit: true, in_transit_grams: 100,
      },
    });
    expect(response.status).toBe(201);
    expect(db.sqlite.prepare(`SELECT is_public, shown_in_shop FROM products WHERE product_name='Private incoming tea'`).get())
      .toEqual({ is_public: 0, shown_in_shop: 0 });
  });

  it('publishes attributed article identities across associated accounts without exposing drafts', async () => {
    const db = database();
    seedIdentity(db);
    seedIdentity(db, { userId: 'writer-user', accountId: 'acc-other', accountSlug: 'other' });
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, beginnings, is_published)
      VALUES ('published-writer','acc-other','writer-user','Published Writer','Beginnings',1),
             ('draft-subject','acc-one','user-one','Draft Subject','Beginnings',0)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role)
      VALUES ('published-writer','acc-one','Guest')`).run();
    db.sqlite.prepare(`INSERT INTO articles
      (id, account_id, title, slug, status, author_id, subject_ids, pull_quote_subject, published_at)
      VALUES ('cross-account-article','acc-one','Cross-account article','cross-account','published',
              'published-writer','["published-writer","draft-subject"]','draft-subject',datetime('now')),
             ('draft-attribution','acc-one','Draft attribution','draft-attribution','published',
              'draft-subject','["draft-subject"]','draft-subject',datetime('now'))`).run();

    const response = await worker.fetch(new Request('https://worker.test/api/articles/cross-account'), { DB: db as any } as any);
    expect(response.status).toBe(200);
    const detail = await response.json() as any;
    expect(detail).toMatchObject({
      author_id: 'published-writer',
      author_name: 'Published Writer',
      subject_ids: ['published-writer'],
      pull_quote_subject: null,
    });
    expect(detail).not.toHaveProperty('account_id');
    expect(detail).not.toHaveProperty('source_event_id');

    const listResponse = await worker.fetch(new Request('https://worker.test/api/articles'), { DB: db as any } as any);
    const list = await listResponse.json() as any[];
    expect(list.find(article => article.slug === 'cross-account')).toMatchObject({
      author_id: 'published-writer', author_name: 'Published Writer',
    });
    expect(list.find(article => article.slug === 'draft-attribution')).toMatchObject({ author_id: null, author_name: null });
    expect(list[0]).not.toHaveProperty('blocks');
    expect(list[0]).not.toHaveProperty('subject_ids');
    expect(list[0]).not.toHaveProperty('pull_quote');
  });

  it('returns only published allowlisted articles for a public product reverse link', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, display_name, is_published)
      VALUES ('writer','acc-one','Writer',1)`).run();
    db.sqlite.prepare(`INSERT INTO products
      (id, account_id, product_name, type, status, is_public, shown_in_shop)
      VALUES ('tea-one','acc-one','Tea One','Oolong','Active',1,1)`).run();
    db.sqlite.prepare(`INSERT INTO articles
      (id, account_id, title, subtitle, slug, status, author_id)
      VALUES ('published','acc-one','Published','Subtitle','published','published','writer'),
             ('draft','acc-one','Draft','Private','draft','draft','writer')`).run();
    db.sqlite.prepare(`INSERT INTO article_products (id, article_id, product_id)
      VALUES ('xp-one','published','tea-one'),('xp-two','draft','tea-one')`).run();

    const response = await worker.fetch(
      new Request('https://worker.test/api/public/xref/products/tea-one/articles'),
      { DB: db as any } as any,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 'published', slug: 'published', title: 'Published', subtitle: 'Subtitle', author_name: 'Writer' },
    ]);
  });

  it('fails closed when xref parent ownership verification cannot read its dependency', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO articles (id, account_id, title, slug, status)
      VALUES ('article-one','acc-one','Article','article','draft')`).run();
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type)
      VALUES ('tea-one','acc-one','Tea','Oolong')`).run();
    const token = await signedToken(SECRET, {
      sub: 'user-one', email: 'user-one@test.dev', name: 'User One', active_account_id: 'acc-one', platform_role: null,
    });
    const failingDb = {
      prepare(sql: string) {
        if (/SELECT 1 FROM articles WHERE id/i.test(sql)) throw new Error('dependency unavailable');
        return db.prepare(sql);
      },
      batch: (statements: any[]) => db.batch(statements),
    };
    const response = await worker.fetch(new Request('https://worker.test/api/xref/articles/article-one/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'acc-one', 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'tea-one' }),
    }), { DB: failingDb as any, JWT_SECRET: SECRET } as any);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'xref_parent_verification_unavailable' });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM article_products`).get()).toEqual({ count: 0 });
  });

  it('cross-links a public shelf only to the shelf owner\'s published contributor identity', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`UPDATE users SET shelf_enabled=1, shelf_slug='mei-shelf' WHERE id='user-one'`).run();
    db.sqlite.prepare(`INSERT INTO contributors
      (id, account_id, user_id, display_name, is_published)
      VALUES ('mei-lin','acc-one','user-one','Mei Lin',1)`).run();

    const response = await worker.fetch(new Request('https://worker.test/api/shelf/mei-shelf'), { DB: db as any } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug: 'mei-shelf', contributor_slug: 'mei-lin' });
    db.sqlite.prepare(`UPDATE contributors SET is_published=0 WHERE id='mei-lin'`).run();
    const privateIdentity = await worker.fetch(new Request('https://worker.test/api/shelf/mei-shelf'), { DB: db as any } as any);
    expect(await privateIdentity.json()).not.toHaveProperty('contributor_slug');
  });

  it('validates Wisdom routes, gates public listings, and lets platform admins delete global relations', async () => {
    const db = database(); seedIdentity(db);
    db.sqlite.prepare(`INSERT INTO articles (id, account_id, title, slug, status)
      VALUES ('article-one','acc-one','Article one','article-one','draft')`).run();

    const invalid = await call(db, '/api/admin/wisdom/relations', {
      method: 'POST',
      body: {
        node_type: 'cultivar', node_id: 'not-in-manifest',
        target_type: 'article', target_id: 'article-one', relationship_kind: 'supports',
      },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'source_node_not_found' });

    seedPublicTea(db, {
      profileId: 'private-shop-tea', productId: 'private-shop-product',
      accountId: 'acc-private', accountSlug: 'private-shop', publicEnabled: false,
    });
    db.sqlite.prepare(`INSERT INTO wisdom_relations
      (id, node_type, node_id, target_type, target_id, relationship_kind, review_status, account_id)
      VALUES ('public-gate','cultivar','rou-gui','tea_profile','private-shop-tea','is_example_of','approved','acc-one'),
             ('global-relation','cultivar','rou-gui','article','article-one','supports','proposed',NULL)`).run();
    db.sqlite.prepare(`INSERT INTO wisdom_relations
      (id, node_type, node_id, target_type, target_id, target_subtype, relationship_kind, review_status, account_id)
      VALUES ('broken-static-target','cultivar','rou-gui','wisdom_node','not-real','region','mentions','approved','acc-one'),
             ('hidden-static-target','cultivar','rou-gui','wisdom_node','wuyi','region','mentions','approved','acc-one')`).run();
    db.sqlite.prepare(`INSERT INTO wisdom_node_overrides (node_type, node_id, public_state)
      VALUES ('region','wuyi','hidden')`).run();

    const hidden = await worker.fetch(
      new Request('https://worker.test/api/public/wisdom/cultivar/rou-gui/related'),
      { DB: db as any } as any,
    );
    expect((await hidden.json() as any).teas).toEqual([]);
    db.sqlite.prepare(`UPDATE accounts SET public_enabled = 1 WHERE id = 'acc-private'`).run();
    const visible = await worker.fetch(
      new Request('https://worker.test/api/public/wisdom/cultivar/rou-gui/related'),
      { DB: db as any } as any,
    );
    expect((await visible.json() as any).teas).toMatchObject([{
      id: 'private-shop-tea', href: '/shop/product/private-shop-product?store=private-shop',
    }]);
    db.sqlite.prepare(`UPDATE products SET is_public=0 WHERE id='private-shop-product'`).run();
    const hiddenProduct = await worker.fetch(
      new Request('https://worker.test/api/public/wisdom/cultivar/rou-gui/related'),
      { DB: db as any } as any,
    );
    expect((await hiddenProduct.json() as any).teas).toEqual([]);

    const findings = await call(db, '/api/admin/wisdom/findings');
    expect((await findings.json() as any).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_target', target_type: 'wisdom_node', target_id: 'not-real' }),
      expect.objectContaining({ code: 'unpublished_dependency', target_type: 'wisdom_node', target_id: 'wuyi' }),
    ]));

    expect((await call(db, '/api/admin/wisdom/relations/global-relation', { method: 'DELETE' })).status).toBe(403);
    seedIdentity(db, { userId: 'platform-admin', platformRole: 'platform_admin' });
    expect((await call(db, '/api/admin/wisdom/relations/global-relation', {
      method: 'DELETE', userId: 'platform-admin', platformRole: 'platform_admin',
    })).status).toBe(200);
    expect(db.sqlite.prepare(`SELECT id FROM wisdom_relations WHERE id = 'global-relation'`).get()).toBeUndefined();
  });
});
