import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Teajia family, stage 3 (todo/plans/teajia-family.md): a page for anyone.
// Driven through worker.fetch against a real SQLite database built from
// worker/schema.sql.

const SECRET = 'family-pages-secret';
const SHOP = 'acc_teajia_bali';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
  vi.unstubAllGlobals();
});

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  // The shop is also the editorial steward, the account that holds people's pages.
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1 WHERE id = ?`).run(SHOP);
  seedIdentity(db, { userId: 'staff', accountId: SHOP, role: 'staff', bundles: ['catalog'] });
  const member = (id: string, name: string, verified = true) =>
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at)
      VALUES (?, ?, ?, 'x', 'user', 0, ?)`).run(id, `${id}@test.dev`, name, verified ? '2026-11-01 00:00:00' : null);
  member('member-one', 'Mei Lin');
  member('member-two', 'Mei Lin');
  member('member-unconfirmed', 'Not Yet', false);
  member('master-user', 'Old Master');
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams)
    VALUES ('tea-a', ?, 'Oolong', 'Tea a', 'Tea a', 1, 'Active', 100)`).run(SHOP);
  for (const id of ['member-one', 'member-two', 'member-unconfirmed']) {
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
      VALUES (?, NULL, ?, 'tea-a', 'Tea a', 9, ?, '[]')`).run(`journal-${id}`, `${id}@test.dev`,
      JSON.stringify({ rating: 9, verdict: 'love', personalNote: 'secret words', tasting: {}, updatedAt: '2026-11-19T00:00:00Z' }));
  }
  return { db, env: { DB: db as any, JWT_SECRET: SECRET } };
}

type Who = { userId: string; account?: string } | null;

async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null, platform_role: null,
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}

const MEMBER = { userId: 'member-one' };
const MEMBER_TWO = { userId: 'member-two' };
const OWNER = { userId: 'owner', account: SHOP };
const STAFF = { userId: 'staff', account: SHOP };

const shareTasting = (env: any, who: Who, state = 'page') =>
  call(env, who, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: state } });
const pageOf = (db: SqliteD1, userId: string) =>
  db.sqlite.prepare('SELECT * FROM contributors WHERE user_id = ?').get(userId) as Record<string, any> | undefined;
const publicPage = async (env: any, id: string) => call(env, null, `/api/people/${id}`);

function addMethod(db: SqliteD1, contributorId: string) {
  db.sqlite.prepare(`INSERT INTO payment_methods (id, contributor_id, account_id, method_type, label, recipient_name, account_identifier, position, is_published)
    VALUES (?, ?, NULL, 'bank_transfer', 'Bank', 'Someone', '123', 0, 1)`).run(`pm-${contributorId}`, contributorId);
}

describe('a page is made on the first share', () => {
  it('makes a live family page the first time a member shares, with no review', async () => {
    const { env, db } = setup();
    expect(pageOf(db, 'member-one')).toBeUndefined();
    const response = await shareTasting(env, MEMBER);
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    const page = pageOf(db, 'member-one')!;
    expect(page).toMatchObject({ id: 'mei-lin', display_name: 'Mei Lin', page_tier: 'family', is_published: 1, account_id: SHOP });
    expect(body).toMatchObject({ page_id: 'mei-lin', page_path: '/people/mei-lin', page_created: true });
    // Live without review: no draft waiting, and the public address answers.
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM contributor_profile_drafts WHERE contributor_id = ?').get('mei-lin')).toMatchObject({ n: 0 });
    const live = await publicPage(env, 'mei-lin');
    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({ id: 'mei-lin', role: 'Teajia family', has_payment_methods: false });
  });

  it('keeps one page and one address on a second share, and a second Mei Lin gets her own address', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    const again = await (await shareTasting(env, MEMBER, 'offered')).json() as any;
    expect(again).toMatchObject({ page_id: 'mei-lin', page_created: false });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM contributors WHERE user_id = ?').get('member-one')).toMatchObject({ n: 1 });
    const other = await (await shareTasting(env, MEMBER_TWO)).json() as any;
    expect(other.page_id).toMatch(/^mei-lin-[0-9a-f]{4}$/);
    expect(other.page_id).not.toBe('mei-lin');
  });

  it('makes no page for a private choice, or for an address nobody confirmed', async () => {
    const { env, db } = setup();
    const keepPrivate = await (await shareTasting(env, MEMBER, 'private')).json() as any;
    expect(keepPrivate).toMatchObject({ page_id: null, page_created: false });
    expect(pageOf(db, 'member-one')).toBeUndefined();
    const unconfirmed = await call(env, { userId: 'member-unconfirmed' }, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    expect(unconfirmed.status).toBe(200);
    expect(await unconfirmed.json()).toMatchObject({ page_id: null });
    expect(pageOf(db, 'member-unconfirmed')).toBeUndefined();
  });

  it('leaves a page that already existed exactly as it was: a draft stays a draft', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published) VALUES ('old-master', ?, 'master-user', 'Old Master', 0)`).run(SHOP);
    const before = pageOf(db, 'master-user');
    const response = await call(env, { userId: 'master-user' }, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    // No journal row for this user, so the tasting refuses; share a photograph's state the other way instead.
    expect(response.status).toBe(409);
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
      VALUES ('journal-master', NULL, 'master-user@test.dev', 'tea-a', 'Tea a', 7, '{}', '[]')`).run();
    const shared = await (await call(env, { userId: 'master-user' }, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } })).json() as any;
    expect(shared).toMatchObject({ page_id: 'old-master', page_created: false });
    expect(pageOf(db, 'master-user')).toEqual(before);
    expect((await publicPage(env, 'old-master')).status).toBe(404);
  });
});

describe('sharing never puts a tea creator or tea master page live', () => {
  it('leaves an unpublished page with a creator or master word unpublished', async () => {
    const { env, db } = setup();
    for (const tier of ['creator', 'master']) {
      db.sqlite.prepare(`DELETE FROM contributors WHERE user_id = 'member-one'`).run();
      db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, page_tier, is_published) VALUES ('mei-${tier}', ?, 'member-one', 'Mei Lin', ?, 0)`).run(SHOP, tier);
      const shared = await (await shareTasting(env, MEMBER)).json() as any;
      expect(shared).toMatchObject({ page_id: `mei-${tier}`, page_created: false });
      expect(pageOf(db, 'member-one')).toMatchObject({ is_published: 0, page_tier: tier });
    }
  });
});

describe('a family page goes live without review; every other page keeps the gate', () => {
  it('puts a family member\'s save on the page at once and never lets them write their own word', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    const saved = await call(env, MEMBER, '/api/me/public-profile', {
      method: 'PUT',
      body: { display_name: 'Mei Lin', role: 'Tea master', beginnings: 'I began with a gaiwan.', links: [{ platform: 'instagram', value: '@mei', qr_image_url: null }] },
    });
    expect(saved.status).toBe(200);
    const page = pageOf(db, 'member-one')!;
    expect(page.beginnings).toBe('I began with a gaiwan.');
    expect(page.role).toBeNull();
    expect(JSON.parse(page.links)).toEqual([{ platform: 'instagram', value: '@mei', qr_image_url: null }]);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM contributor_profile_drafts WHERE contributor_id = ?').get('mei-lin')).toMatchObject({ n: 0 });
    const live = await (await publicPage(env, 'mei-lin')).json() as any;
    expect(live).toMatchObject({ role: 'Teajia family', beginnings: 'I began with a gaiwan.' });
    expect(live.links).toHaveLength(1);
    const mine = await (await call(env, MEMBER, '/api/me/public-profile')).json() as any;
    expect(mine.contributor).toMatchObject({ page_tier: 'family', role: 'Teajia family', publication_state: 'published' });
  });

  it('puts a taken-down family page back live when the member saves again', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    await call(env, MEMBER, '/api/me/public-profile/unpublish', { method: 'POST' });
    expect((await publicPage(env, 'mei-lin')).status).toBe(404);
    await call(env, MEMBER, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Mei Lin' } });
    expect(pageOf(db, 'member-one')).toMatchObject({ is_published: 1, unpublished_at: null });
    expect((await publicPage(env, 'mei-lin')).status).toBe(200);
  });

  it('keeps the draft-and-approve gate for a page with no family word, as it was', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, beginnings, is_published) VALUES ('old-master', ?, 'master-user', 'Old Master', 'Live words.', 1)`).run(SHOP);
    const saved = await call(env, { userId: 'master-user' }, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Old Master', beginnings: 'New words.' } });
    expect(saved.status).toBe(200);
    expect(pageOf(db, 'master-user')!.beginnings).toBe('Live words.');
    expect(db.sqlite.prepare('SELECT approval_status FROM contributor_profile_drafts WHERE contributor_id = ?').get('old-master')).toMatchObject({ approval_status: 'pending' });
    expect(await (await publicPage(env, 'old-master')).json()).toMatchObject({ beginnings: 'Live words.' });
  });

  it('keeps the gate for a tea creator and a tea master', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    for (const tier of ['creator', 'master']) {
      const set = await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier } });
      expect(set.status).toBe(200);
      await call(env, MEMBER, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Mei Lin', beginnings: `Words as ${tier}.` } });
      expect(pageOf(db, 'member-one')!.beginnings).not.toBe(`Words as ${tier}.`);
      expect(db.sqlite.prepare('SELECT approval_status FROM contributor_profile_drafts WHERE contributor_id = ?').get('mei-lin')).toMatchObject({ approval_status: 'pending' });
    }
  });

  it('puts words a changed word left waiting live when the page goes back to family, so nothing is lost', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'master' } });
    await call(env, MEMBER, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Mei Lin', beginnings: 'Waiting words.' } });
    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'family' } });
    await call(env, MEMBER, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Mei Lin', closing: 'Drink well.' } });
    expect(pageOf(db, 'member-one')).toMatchObject({ beginnings: 'Waiting words.', closing: 'Drink well.' });
    expect(db.sqlite.prepare('SELECT approval_status FROM contributor_profile_drafts WHERE contributor_id = ?').get('mei-lin')).toMatchObject({ approval_status: 'approved' });
  });
});

describe('Pay shows for tea masters only', () => {
  it('shows no Pay on a family or creator page, refuses to add a method, and keeps a page from before the family as it was', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    addMethod(db, 'mei-lin');
    expect(await (await publicPage(env, 'mei-lin')).json()).toMatchObject({ has_payment_methods: false, payment_accounts: [] });
    expect((await call(env, null, '/api/public/people/mei-lin/payment-methods')).status).toBe(404);
    const add = await call(env, MEMBER, '/api/me/profile/payment-methods', {
      method: 'POST',
      body: { method_type: 'bank_transfer', label: 'Bank', recipient_name: 'Mei', account_identifier: '9', is_published: true },
    });
    expect(add.status).toBe(403);
    expect(await add.json()).toMatchObject({ code: 'pay_not_for_this_page' });

    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'creator' } });
    expect(await (await publicPage(env, 'mei-lin')).json()).toMatchObject({ has_payment_methods: false });

    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'master' } });
    expect(await (await publicPage(env, 'mei-lin')).json()).toMatchObject({ has_payment_methods: true });

    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, beginnings, is_published) VALUES ('old-master', ?, 'master-user', 'Old Master', 'Words.', 1)`).run(SHOP);
    addMethod(db, 'old-master');
    expect(await (await publicPage(env, 'old-master')).json()).toMatchObject({ has_payment_methods: true });
  });
});

describe('the owner\'s word for a person', () => {
  it('changes only the word: the address and every written field stay, and it can go back', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    await call(env, MEMBER, '/api/me/public-profile', { method: 'PUT', body: { display_name: 'Mei Lin', beginnings: 'Words.', location_line: 'Taipei' } });
    const written = (row: Record<string, any>) => {
      const { page_tier, updated_at, ...rest } = row;
      return rest;
    };
    // The list shows a person once their page has a photograph.
    db.sqlite.prepare(`UPDATE contributors SET portrait_url = 'mei.jpg' WHERE id = 'mei-lin'`).run();
    const before = written(pageOf(db, 'member-one')!);

    const creator = await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'creator' } });
    expect(await creator.json()).toMatchObject({ id: 'mei-lin', page_tier: 'creator', word: 'Tea creator', pay: false });
    expect(written(pageOf(db, 'member-one')!)).toEqual(before);
    expect(await (await publicPage(env, 'mei-lin')).json()).toMatchObject({ id: 'mei-lin', role: 'Tea creator', beginnings: 'Words.' });
    const list = await (await call(env, null, '/api/people')).json() as any;
    expect(list.contributors.find((item: any) => item.id === 'mei-lin').role).toBe('Tea creator');

    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'master' } });
    expect((await (await publicPage(env, 'mei-lin')).json() as any).role).toBe('Tea master');
    await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'family' } });
    expect((await (await publicPage(env, 'mei-lin')).json() as any).role).toBe('Teajia family');
    expect(written(pageOf(db, 'member-one')!)).toEqual(before);
  });

  it('is the owner\'s alone: a member, staff and a signed-out visitor are refused, and so is a made-up word', async () => {
    const { env, db } = setup();
    await shareTasting(env, MEMBER);
    for (const who of [MEMBER, STAFF, null]) {
      const refused = await call(env, who, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'master' } });
      expect([401, 403]).toContain(refused.status);
    }
    expect(pageOf(db, 'member-one')!.page_tier).toBe('family');
    const invalid = await call(env, OWNER, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'Tea master of everything' } });
    expect(invalid.status).toBe(400);
    const missing = await call(env, OWNER, '/api/admin/family/pages/nobody/tier', { method: 'PUT', body: { tier: 'master' } });
    expect(missing.status).toBe(404);
    expect(pageOf(db, 'member-one')!.page_tier).toBe('family');
  });

  it('cannot reach a page held by another shop', async () => {
    const { env, db } = setup();
    seedIdentity(db, { userId: 'other-owner', accountId: 'acc-other', role: 'owner' });
    await shareTasting(env, MEMBER);
    const refused = await call(env, { userId: 'other-owner', account: 'acc-other' }, '/api/admin/family/pages/mei-lin/tier', { method: 'PUT', body: { tier: 'master' } });
    expect(refused.status).toBe(404);
    expect(pageOf(db, 'member-one')!.page_tier).toBe('family');
  });
});
