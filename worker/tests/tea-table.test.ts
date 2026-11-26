import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The Tea Table (Launch 4, K1 and K2) and its consent gate from the K0 audit:
// a piece is on the table only when it was put there under the Tea Table
// wording; a shared tasting shows the sittings shared and nothing written
// later; no answer carries a score; a withdrawn or hidden piece is gone from
// every view at once; keep counts are read by the platform owner alone; a hold
// ends; a host holds only their own. Driven through worker.fetch against
// SQLite built from the migration ledger.

const SECRET = 'tea-table-secret';
const SHOP = 'acc_teajia_bali';
const OTHER = 'acc-other-house';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, accountSlug: 'teajia-bali', role: 'owner' });
  seedIdentity(db, { userId: 'other-host', accountId: OTHER, accountSlug: 'other-house', role: 'owner' });
  seedIdentity(db, { userId: 'platform-owner', accountId: 'acc-platform', platformRole: 'platform_owner' });
  for (const id of ['member-one', 'member-two']) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at)
      VALUES (?, ?, ?, 'x', 'user', 0, '2026-11-01')`).run(id, `${id}@test.dev`, id);
  }
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams,
      tasting, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
    VALUES ('tea-a', ?, 'Oolong', 'Tea A', 'Tea A', 1, 1, 'Active', 100, ?, NULL, NULL, NULL, NULL)`).run(
    SHOP, JSON.stringify({ quality: 8, rating: 7, notes: ['Stone fruit'] }),
  );
  // Member one's journal for tea-a: one sitting, with a score the table must never carry.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES ('journal-one', NULL, 'member-one@test.dev', 'tea-a', 'Tea A', 9, ?, ?)`).run(
    JSON.stringify({ rating: 9, verdict: 'love', tasting: {} }),
    JSON.stringify([{ id: 's1', createdAt: '2026-11-10T08:00:00Z', rating: 9, tasting: { notes: ['Orchid on the lid'], quality: 9 } }]),
  );
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
    VALUES ('mei', ?, 'member-one', 'Mei', 1, 'family', '[]')`).run(SHOP);
  // Shared on 12 November under the older "On my page" wording: no Tea Table moment.
  db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
    VALUES ('journal-one', ?, 'tea-a', 'member-one', 'page', '2026-11-12 10:00:00', '2026-11-12 10:00:00')`).run(SHOP);
  db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id,
      journal_entry_id, full_key, small_key, full_bytes, small_bytes, full_width, full_height, small_width, small_height,
      share_state, shop_use, created_at, updated_at, shape)
    VALUES ('photo-1', ?, 'tea-a', 'member-one', 'journal-one', 'family-photos/photo-1/full.jpg', 'family-photos/photo-1/small.jpg',
      10, 5, 2000, 1500, 480, 360, 'page', 'none', '2026-11-12 10:00:00', '2026-11-12 10:00:00', 'square')`).run(SHOP);
  // Two published recaps, one in each house.
  db.sqlite.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status, network_discovery)
    VALUES ('event-1', '${SHOP}', 'autumn-sit', 'Autumn sit', '2026-11-20', 'completed', 'public', 'published', 1),
           ('event-2', '${OTHER}', 'other-sit', 'Other sit', '2026-11-21', 'completed', 'public', 'published', 1),
           ('event-draft', '${SHOP}', 'draft-sit', 'Draft sit', '2026-11-22', 'completed', 'public', 'draft', 1);
    INSERT INTO event_post_session (id, account_id, event_id, session_notes)
    VALUES ('recap-1', '${SHOP}', 'event-1', 'We poured three oolongs.'),
           ('recap-2', '${OTHER}', 'event-2', 'A quiet table.'),
           ('recap-3', '${SHOP}', 'event-draft', 'Not yet.');
  `);
  // Each house's owner hosted its own sessions (A4 review, finding 7: only a host acts on a recap).
  hostOf(db, 'owner', SHOP, ['event-1', 'event-draft']);
  hostOf(db, 'other-host', OTHER, ['event-2']);
  const env = { DB: db as any, JWT_SECRET: SECRET, TEA_TABLE_OPEN: 'true', PROVIDER_LIMITER: { limit: async () => ({ success: true }) } };
  return { db, env };
}

/** Credits a person as lead host of sessions, through an unpublished page of their own in that house. */
function hostOf(db: SqliteD1, userId: string, account: string, events: string[], role = 'lead_host') {
  const page = `${userId}-page`;
  db.sqlite.prepare(`INSERT OR IGNORE INTO contributors (id, account_id, user_id, display_name, is_published, links)
    VALUES (?, ?, ?, ?, 0, '[]')`).run(page, account, userId, userId);
  db.sqlite.prepare('INSERT OR IGNORE INTO contributor_accounts (contributor_id, account_id) VALUES (?, ?)').run(page, account);
  for (const event of events) {
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
      VALUES (?, ?, ?, ?, ?, 0)`).run(`credit-${page}-${event}-${role}`, account, event, page, role);
  }
}

type Who = { userId: string; account?: string } | null;
async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null,
      platform_role: null, session_version: 0,
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}
async function ok(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await call(env, who, path, init);
  expect(response.status, `${init.method ?? 'GET'} ${path}`).toBe(200);
  return await response.json() as any;
}
const table = (env: any, query = '') => ok(env, null, `/api/tea-table${query}`);
const keys = (page: any) => [...page.held, ...page.items].map((item: any) => `${item.kind}:${item.id}`);

const MEMBER = { userId: 'member-one' };
const READER = { userId: 'member-two' };
const HOST = { userId: 'owner', account: SHOP };
const OTHER_HOST = { userId: 'other-host', account: OTHER };
const PLATFORM = { userId: 'platform-owner' };

const shareToTable = (env: any, extra: Record<string, unknown> = { tea_table: true }) =>
  ok(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page', ...extra } });
const putRecap = (env: any, who: Who, id = 'event-1') => call(env, who, `/api/admin/tea-table/recaps/${id}`, { method: 'PUT' });

describe('the consent gate', () => {
  it('lets gather staff manage a recap for their own shop without publish', async () => {
    const { db, env } = setup();
    const gather = { userId: 'gather-staff', account: SHOP };
    const publish = { userId: 'publish-staff', account: SHOP };
    seedIdentity(db, { userId: gather.userId, accountId: SHOP, role: 'staff', bundles: ['gather'] });
    seedIdentity(db, { userId: publish.userId, accountId: SHOP, role: 'staff', bundles: ['publish'] });
    hostOf(db, gather.userId, SHOP, ['event-1'], 'co_host');
    hostOf(db, publish.userId, SHOP, ['event-1'], 'co_host');
    const path = '/api/admin/tea-table/recaps/event-1';
    expect(await ok(env, gather, path)).toMatchObject({ eligible: true, on_table: false });
    expect((await call(env, publish, path, { method: 'PUT' })).status).toBe(403);
    expect((await putRecap(env, gather, 'event-2')).status).toBe(404);
    expect(await ok(env, gather, path, { method: 'PUT' })).toMatchObject({ on_table: true });
    await ok(env, gather, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 3 } });
    expect(await ok(env, gather, path, { method: 'DELETE' })).toMatchObject({ on_table: false });
  });

  it('leaves off a tasting shared under the older "On my page" wording', async () => {
    const { env } = setup();
    expect(keys(await table(env))).toEqual([]);
  });

  it('shows the tasting once it is shared again under the Tea Table wording', async () => {
    const { env, db } = setup();
    const shared = await shareToTable(env);
    expect(shared.on_tea_table).toBe(true);
    const page = await table(env);
    expect(keys(page)).toEqual(['tasting:journal-one']);
    const [item] = page.items;
    expect(item.person).toEqual({ name: 'Mei', path: '/people/mei' });
    expect(item.tea.name).toBe('Tea A');
    expect(item.words.map((word: any) => word.text)).toEqual(['Orchid on the lid']);
    expect(item.photographs.map((photo: any) => photo.id)).toEqual(['photo-1']);
    const row = db.sqlite.prepare('SELECT tea_table_at, tea_table_sittings FROM member_tasting_shares').get() as any;
    expect(row.tea_table_at).toBeTruthy();
    expect(JSON.parse(row.tea_table_sittings)).toEqual(['s1']);
  });

  it('does not record a share made without the Tea Table wording, or while the Tea Table is closed', async () => {
    const { env } = setup();
    expect((await shareToTable(env, {})).on_tea_table).toBe(false);
    expect(keys(await table(env))).toEqual([]);
    const closed = { ...env, TEA_TABLE_OPEN: 'false' };
    expect((await shareToTable(closed)).on_tea_table).toBe(false);
    expect((await call(closed, null, '/api/tea-table')).status).toBe(404);
    expect(keys(await table(env))).toEqual([]);
  });

  it('never shows a later sitting, a note written later, or a photograph taken later', async () => {
    const { env, db } = setup();
    await shareToTable(env);
    // After the share: a second sitting kept private, a later note on the shared sitting, a later photograph.
    db.sqlite.prepare('UPDATE customer_tasting_journal SET tastings = ? WHERE id = ?').run(JSON.stringify([
      { id: 's1', createdAt: '2026-11-10T08:00:00Z', tasting: { notes: ['Orchid on the lid', { id: 'n9', text: 'Added much later', capturedAt: '2099-01-01T00:00:00Z' }] } },
      { id: 's2', createdAt: '2099-01-02T08:00:00Z', tasting: { notes: ['A private second sitting'] } },
    ]), 'journal-one');
    db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id,
        journal_entry_id, full_key, small_key, full_bytes, small_bytes, full_width, full_height, small_width, small_height,
        share_state, shop_use, created_at, updated_at, shape)
      VALUES ('photo-later', ?, 'tea-a', 'member-one', 'journal-one', 'f', 's', 10, 5, 2000, 1500, 480, 360, 'page', 'none', '2099-01-02 00:00:00', '2099-01-02 00:00:00', 'square')`).run(SHOP);
    const [item] = (await table(env)).items;
    expect(item.words.map((word: any) => word.text)).toEqual(['Orchid on the lid']);
    expect(item.photographs.map((photo: any) => photo.id)).toEqual(['photo-1']);
  });

  it('shows a recap only once its host puts the published recap on the table', async () => {
    const { env } = setup();
    expect(keys(await table(env))).toEqual([]);
    expect((await putRecap(env, HOST)).status).toBe(200);
    expect(keys(await table(env))).toEqual(['recap:event-1']);
    // A draft recap cannot go on.
    expect((await putRecap(env, HOST, 'event-draft')).status).toBe(409);
    const sessions = await table(env, '?show=sessions');
    expect(sessions.items[0]).toMatchObject({ kind: 'recap', slug: 'autumn-sit', title: 'Autumn sit', writing: 'We poured three oolongs.' });
    expect(keys(await table(env, '?show=tastings'))).toEqual([]);
  });
});

describe('only a host of the session acts on its recap (A4 review, finding 7)', () => {
  it('refuses a shop member who did not host it, and keeps the platform owner\'s hand', async () => {
    const { db, env } = setup();
    // Staff of the same shop with gather and publish, and the shop's own owner on a session hosted by someone else.
    const staff = { userId: 'shop-staff', account: SHOP };
    seedIdentity(db, { userId: staff.userId, accountId: SHOP, role: 'staff', bundles: ['gather', 'publish'] });
    db.sqlite.exec(`
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status, network_discovery)
      VALUES ('event-guest', '${SHOP}', 'guest-sit', 'Guest sit', '2026-11-23', 'completed', 'public', 'published', 1);
      INSERT INTO event_post_session (id, account_id, event_id, session_notes) VALUES ('recap-4', '${SHOP}', 'event-guest', 'A guest poured.');
    `);
    hostOf(db, 'member-two', SHOP, ['event-guest'], 'guest_host');
    for (const [who, id] of [[staff, 'event-1'], [HOST, 'event-guest']] as const) {
      const path = `/api/admin/tea-table/recaps/${id}`;
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const refused = await call(env, who, path, { method });
        expect(refused.status, `${who.userId} ${method} ${id}`).toBe(403);
        expect(((await refused.json()) as any).code).toBe('not_host');
      }
      expect((await call(env, who, `/api/tea-table/holds/recap/${id}`, { method: 'PUT', body: { days: 3 } })).status).toBe(403);
    }
    expect(keys(await table(env))).toEqual([]);
    // The host of the session may; the platform owner may act on any.
    expect(await ok(env, HOST, '/api/admin/tea-table/recaps/event-1', { method: 'PUT' })).toMatchObject({ on_table: true });
    expect((await call(env, staff, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 3 } })).status).toBe(403);
    expect((await call(env, staff, '/api/tea-table/holds/recap/event-1', { method: 'DELETE' })).status).toBe(403);
    expect(await ok(env, PLATFORM, '/api/admin/tea-table/recaps/event-guest', { method: 'PUT' })).toMatchObject({ on_table: true });
    await ok(env, PLATFORM, '/api/tea-table/holds/recap/event-guest', { method: 'PUT', body: { days: 2 } });
    expect((await table(env)).held.map((item: any) => item.id)).toEqual(['event-guest']);
  });
});

describe('no score in any answer', () => {
  it('carries no rating, quality, verdict or count anywhere a reader can see', async () => {
    const { env } = setup();
    await shareToTable(env);
    await putRecap(env, HOST);
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    const answers = [
      await table(env), await table(env, '?show=tastings'),
      await ok(env, READER, '/api/tea-table/me'), await ok(env, MEMBER, '/api/tea-table/me'),
      await ok(env, READER, '/api/tea-table/keeps/recap/event-1', { method: 'PUT' }),
    ];
    for (const answer of answers) {
      const text = JSON.stringify(answer);
      expect(text).not.toMatch(/rating|quality|verdict|score|keeps|count/i);
      expect(text).not.toMatch(/"love"/);
    }
  });
});

describe('withdrawn and hidden pieces vanish from every view at once', () => {
  async function onTableAndKept(env: any) {
    await shareToTable(env);
    await putRecap(env, HOST);
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    await ok(env, READER, '/api/tea-table/keeps/recap/event-1', { method: 'PUT' });
    await ok(env, PLATFORM, '/api/tea-table/holds/tasting/journal-one', { method: 'PUT', body: { days: 3 } });
    expect(keys(await table(env)).sort()).toEqual(['recap:event-1', 'tasting:journal-one']);
  }
  const kept = async (env: any) => (await ok(env, READER, '/api/tea-table/me')).kept.map((item: any) => `${item.kind}:${item.id}`);

  it('a tasting set private is gone from the stream, the held pieces and everyone\'s keeps', async () => {
    const { env } = setup();
    await onTableAndKept(env);
    await ok(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'private' } });
    expect(keys(await table(env))).toEqual(['recap:event-1']);
    expect(await kept(env)).toEqual(['recap:event-1']);
  });

  it('the author takes a tasting off the table; shared on their page before, it stays there', async () => {
    const { env, db } = setup();
    await onTableAndKept(env);
    expect((await ok(env, MEMBER, '/api/tea-table/me')).mine).toEqual(['tasting:journal-one']);
    // Nobody else can take it off.
    expect((await call(env, READER, '/api/tea-table/mine/tasting/journal-one', { method: 'DELETE' })).status).toBe(404);
    await ok(env, MEMBER, '/api/tea-table/mine/tasting/journal-one', { method: 'DELETE' });
    expect(keys(await table(env))).toEqual(['recap:event-1']);
    expect(await kept(env)).toEqual(['recap:event-1']);
    expect((db.sqlite.prepare('SELECT share_state FROM member_tasting_shares').get() as any).share_state).toBe('page');
    const page = await ok(env, null, '/api/people/mei');
    expect(page.tastings.find((tea: any) => tea.product_id === 'tea-a').words.map((word: any) => word.text)).toEqual(['Orchid on the lid']);
  });

  it('the author takes off a tasting the table alone made public; it goes private everywhere (A4 review, finding 1)', async () => {
    const { env, db } = setup();
    // Never on the page by itself: the first share is the Tea Table share.
    db.sqlite.prepare(`DELETE FROM member_tasting_shares`).run();
    db.sqlite.prepare(`UPDATE member_photographs SET share_state = 'private'`).run();
    await onTableAndKept(env);
    // An offered quote the shop approved, and a photograph it placed.
    db.sqlite.prepare(`UPDATE member_photographs SET offered_at = '2026-11-12', shop_use = 'placed'`).run();
    db.sqlite.prepare(`INSERT INTO tasting_note_candidates (id, account_id, journal_entry_id, note_key, product_id, author_user_id,
        source_text, status, attribution_name, offered_at, promoted_at, promoted_by, created_at, updated_at)
      VALUES ('cand-1', ?, 'journal-one', 'n1', 'tea-a', 'member-one', 'Orchid on the lid', 'promoted', 'Mei', '2026-11-12', '2026-11-13', 'owner', '2026-11-12', '2026-11-13')`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO product_impressions (id, account_id, product_id, candidate_id, text, attribution_name, published_at, published_by,
        created_at, show_on_listing, show_on_main_page)
      VALUES ('imp-1', ?, 'tea-a', 'cand-1', 'Orchid on the lid', 'Mei', '2026-11-13', 'owner', '2026-11-13', 1, 1)`).run(SHOP);
    const words = async () => (await ok(env, null, '/api/people/mei')).tastings.find((tea: any) => tea.product_id === 'tea-a');
    expect((await words()).words.map((word: any) => word.text)).toEqual(['Orchid on the lid']);
    expect(await ok(env, null, '/api/products/tea-a/impressions')).toHaveLength(1);

    expect(await ok(env, MEMBER, '/api/tea-table/mine/tasting/journal-one', { method: 'DELETE' })).toMatchObject({ on_table: false, on_page: false });
    expect(keys(await table(env))).toEqual(['recap:event-1']);
    expect(await kept(env)).toEqual(['recap:event-1']);
    expect(await words()).toBeUndefined();
    expect(await ok(env, null, '/api/products/tea-a/impressions')).toEqual([]);
    const tea = await ok(env, null, '/api/family/teas/tea-a/photographs');
    expect(tea).toMatchObject({ lead: null, placed: [], family: [] });
    expect(db.sqlite.prepare('SELECT share_state, tea_table_at FROM member_tasting_shares').get()).toEqual({ share_state: 'private', tea_table_at: null });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM tea_table_holds WHERE item_kind = 'tasting'`).get()).toEqual({ n: 0 });
    // Shared again, it goes back on both, and taken off it goes private again.
    await shareToTable(env);
    await ok(env, MEMBER, '/api/tea-table/mine/tasting/journal-one', { method: 'DELETE' });
    expect(await words()).toBeUndefined();
  });

  it('the shop\'s hide and the platform owner\'s hide take a piece off, and restoring brings it back', async () => {
    const { env } = setup();
    await onTableAndKept(env);
    await ok(env, HOST, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'tasting', target_id: 'journal-one' } });
    expect(keys(await table(env))).toEqual(['recap:event-1']);
    expect((await ok(env, MEMBER, '/api/tea-table/me')).mine).toEqual([]);
    await ok(env, HOST, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'tasting', target_id: 'journal-one' } });
    expect(keys(await table(env)).sort()).toEqual(['recap:event-1', 'tasting:journal-one']);
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'recap', id: 'event-1', hidden: true } });
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'tasting', id: 'journal-one', hidden: true } });
    expect(keys(await table(env))).toEqual([]);
    expect(await kept(env)).toEqual([]);
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'recap', id: 'event-1', hidden: false } });
    expect(keys(await table(env))).toEqual(['recap:event-1']);
  });

  it('the platform owner\'s hide takes a recap off every public place; the host\'s take-off leaves its own page (A4 review, finding 2)', async () => {
    const { env, db } = setup();
    // Mei is credited as the session's photographer and shows it on her page.
    db.sqlite.prepare('INSERT INTO contributor_accounts (contributor_id, account_id) VALUES (?, ?)').run('mei', SHOP);
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
      VALUES ('credit-mei', ?, 'event-1', 'mei', 'photographer', 1)`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO sit_profile_placements (account_id, event_id, contributor_id, role)
      VALUES (?, 'event-1', 'mei', 'photographer')`).run(SHOP);
    const everywhere = async () => {
      const recent = await (await call(env, null, '/api/public/sit-links/recent', { method: 'POST' })).json() as any;
      const links = await (await call(env, null, '/api/public/sit-links/people/mei')).json() as any;
      return {
        detail: (await call(env, null, '/api/public/sit-recaps/autumn-sit')).status,
        legacy: (await call(env, null, '/api/events/autumn-sit/recap')).status,
        recent: recent.recaps.map((recap: any) => recap.slug).sort(),
        links: links.recaps.map((recap: any) => recap.slug),
        table: keys(await table(env)),
      };
    };
    // A published recap never put on the table is public, as it always was.
    expect(await everywhere()).toEqual({ detail: 200, legacy: 200, recent: ['autumn-sit', 'other-sit'], links: ['autumn-sit'], table: [] });
    await putRecap(env, HOST);
    expect((await everywhere()).table).toEqual(['recap:event-1']);
    // The host takes it off the table: it stays public on its own page.
    await ok(env, HOST, '/api/admin/tea-table/recaps/event-1', { method: 'DELETE' });
    expect(await everywhere()).toEqual({ detail: 200, legacy: 200, recent: ['autumn-sit', 'other-sit'], links: ['autumn-sit'], table: [] });
    // The platform owner hides it: gone from every place, on the table or not.
    await putRecap(env, HOST);
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'recap', id: 'event-1', hidden: true } });
    expect(await everywhere()).toEqual({ detail: 404, legacy: 404, recent: ['other-sit'], links: [], table: [] });
    db.sqlite.prepare(`UPDATE events SET tea_table_at = NULL`).run();
    expect((await everywhere()).detail).toBe(404);
    // Restored, it is public again.
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'recap', id: 'event-1', hidden: false } });
    expect(await everywhere()).toMatchObject({ detail: 200, legacy: 200, links: ['autumn-sit'] });
  });

  it('sends a recap with no-store, so a hidden one is not kept (A4 review, finding 4)', async () => {
    const { env } = setup();
    for (const path of ['/api/events/autumn-sit/recap', '/api/public/sit-recaps/autumn-sit']) {
      const response = await call(env, null, path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get('Cache-Control'), path).toBe('no-store');
    }
    await ok(env, PLATFORM, '/api/admin/tea-table/hide', { method: 'POST', body: { kind: 'recap', id: 'event-1', hidden: true } });
    expect((await call(env, null, '/api/events/autumn-sit/recap')).headers.get('Cache-Control')).toBe('no-store');
  });

  it('a host takes their recap off, and an unpublished recap is gone too', async () => {
    const { env, db } = setup();
    await onTableAndKept(env);
    await ok(env, HOST, '/api/admin/tea-table/recaps/event-1', { method: 'DELETE' });
    expect(keys(await table(env))).toEqual(['tasting:journal-one']);
    await putRecap(env, HOST);
    db.sqlite.prepare(`UPDATE events SET recap_status = 'draft' WHERE id = 'event-1'`).run();
    expect(keys(await table(env))).toEqual(['tasting:journal-one']);
    expect(await kept(env)).toEqual(['tasting:journal-one']);
  });
});

describe('the private keep and its count', () => {
  it('keep counts are read by the platform owner alone', async () => {
    const { env } = setup();
    await shareToTable(env);
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    await ok(env, MEMBER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    expect((await call(env, null, '/api/admin/tea-table')).status).toBe(401);
    expect((await call(env, READER, '/api/admin/tea-table')).status).toBe(403);
    expect((await call(env, HOST, '/api/admin/tea-table')).status).toBe(403);
    expect((await call(env, OTHER_HOST, '/api/admin/tea-table')).status).toBe(403);
    const manage = await ok(env, PLATFORM, '/api/admin/tea-table');
    expect(manage.items).toEqual([expect.objectContaining({ kind: 'tasting', id: 'journal-one', keeps: 2, showing: true, hidden: false })]);
    // A person's own keeps list says what they kept, never how many others did.
    const mine = await ok(env, READER, '/api/tea-table/me');
    expect(mine.kept.map((item: any) => item.id)).toEqual(['journal-one']);
    expect(JSON.stringify(mine)).not.toMatch(/keeps|count/);
  });

  it('only a piece on the table can be kept, and a keep can be let go', async () => {
    const { env } = setup();
    expect((await call(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' })).status).toBe(404);
    expect((await call(env, null, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' })).status).toBe(401);
    await shareToTable(env);
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'DELETE' });
    expect((await ok(env, READER, '/api/tea-table/me')).kept).toEqual([]);
  });
});

describe('holding a piece at the top', () => {
  it('a held piece sits above newer ones, and falls back into time order when the hold ends', async () => {
    const { env, db } = setup();
    await shareToTable(env);
    db.sqlite.prepare(`UPDATE member_tasting_shares SET tea_table_at = datetime('now', '-2 days')`).run();
    await putRecap(env, HOST);
    expect(keys(await table(env))).toEqual(['recap:event-1', 'tasting:journal-one']);
    const held = await ok(env, PLATFORM, '/api/tea-table/holds/tasting/journal-one', { method: 'PUT', body: { days: 3 } });
    expect(held.held_until).toBeTruthy();
    let page = await table(env);
    expect(page.held.map((item: any) => item.id)).toEqual(['journal-one']);
    expect(page.items.map((item: any) => item.id)).toEqual(['event-1']);
    // A held piece is not on the pages further back either.
    db.sqlite.prepare(`UPDATE tea_table_holds SET held_until = datetime('now', '-1 minute')`).run();
    page = await table(env);
    expect(page.held).toEqual([]);
    expect(page.items.map((item: any) => item.id)).toEqual(['event-1', 'journal-one']);
  });

  it('a hold always ends, within fourteen days', async () => {
    const { env } = setup();
    await putRecap(env, HOST);
    for (const days of [0, 15, 1.5, 'three']) {
      expect((await call(env, HOST, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days } })).status).toBe(400);
    }
    await ok(env, HOST, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 14 } });
    expect((await table(env)).held.map((item: any) => item.id)).toEqual(['event-1']);
  });

  it('a host holds only their own session; a tasting is held by the platform owner alone', async () => {
    const { env } = setup();
    await shareToTable(env);
    await putRecap(env, HOST);
    await putRecap(env, OTHER_HOST, 'event-2');
    // The other house cannot hold, put on or take off this house's recap.
    expect((await call(env, OTHER_HOST, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 3 } })).status).toBe(404);
    expect((await call(env, OTHER_HOST, '/api/admin/tea-table/recaps/event-1', { method: 'DELETE' })).status).toBe(404);
    // A member with no house, and a host, cannot hold a tasting.
    expect((await call(env, READER, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 3 } })).status).toBe(403);
    expect((await call(env, HOST, '/api/tea-table/holds/tasting/journal-one', { method: 'PUT', body: { days: 3 } })).status).toBe(403);
    expect((await call(env, MEMBER, '/api/tea-table/holds/tasting/journal-one', { method: 'PUT', body: { days: 3 } })).status).toBe(403);
    await ok(env, OTHER_HOST, '/api/tea-table/holds/recap/event-2', { method: 'PUT', body: { days: 3 } });
    expect((await table(env)).held.map((item: any) => item.id)).toEqual(['event-2']);
    // The platform owner may hold and let go of any piece.
    await ok(env, PLATFORM, '/api/tea-table/holds/recap/event-1', { method: 'PUT', body: { days: 2 } });
    await ok(env, PLATFORM, '/api/tea-table/holds/recap/event-2', { method: 'DELETE' });
    expect((await table(env)).held.map((item: any) => item.id)).toEqual(['event-1']);
  });
});

describe('earlier pages', () => {
  it('walks back in time with "before" and never repeats a piece', async () => {
    const { env, db } = setup();
    await shareToTable(env);
    db.sqlite.prepare(`UPDATE member_tasting_shares SET tea_table_at = '2026-11-01 09:00:00'`).run();
    await putRecap(env, HOST);
    const first = await table(env);
    expect(first.earlier).toBeNull();
    const before = await table(env, `?before=${encodeURIComponent('2026-11-02 00:00:00')}`);
    expect(before.held).toEqual([]);
    expect(keys(before)).toEqual(['tasting:journal-one']);
    expect((await call(env, null, '/api/tea-table?before=not-a-date')).status).toBe(400);
    expect((await call(env, null, '/api/tea-table?show=popular')).status).toBe(400);
  });
});

describe('account deletion', () => {
  it('clears the person\'s keeps and holds with the rest of their family rows', async () => {
    const { env, db } = setup();
    await shareToTable(env);
    await ok(env, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' });
    await ok(env, PLATFORM, '/api/tea-table/holds/tasting/journal-one', { method: 'PUT', body: { days: 3 } });
    const { familyErasureStatements } = await import('../src/familyErasure');
    await (db as any).batch(familyErasureStatements(db as any, 'member-one'));
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_table_keeps').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_table_holds').get()).toEqual({ n: 0 });
  });
});

// A4 review, finding 14: a hold never hides a piece, a page boundary never
// loses one, and sharing a tasting again does not move it forward.
describe('every piece, once', () => {
  /** n published recaps in the house, each put on the table at the given moment. */
  function recaps(db: SqliteD1, n: number, at: (i: number) => string) {
    for (let i = 0; i < n; i += 1) {
      const id = `bulk-${String(i).padStart(2, '0')}`;
      db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility,
          recap_status, network_discovery, tea_table_at)
        VALUES (?, ?, ?, ?, '2026-11-01', 'completed', 'public', 'published', 1, ?)`).run(id, SHOP, id, `Sit ${i}`, at(i));
      db.sqlite.prepare(`INSERT INTO event_post_session (id, account_id, event_id, session_notes) VALUES (?, ?, ?, 'Tea.')`)
        .run(`post-${id}`, SHOP, id);
    }
  }
  async function walk(env: any) {
    const seen: string[] = [];
    let before: string | null = null;
    for (let page = 0; page < 20; page += 1) {
      const body: any = await table(env, before ? `?before=${encodeURIComponent(before)}` : '');
      seen.push(...keys(body));
      if (!body.earlier) break;
      before = body.earlier;
    }
    return seen;
  }

  it('walks every page without losing a piece put on the table in the same second', async () => {
    const { db, env } = setup();
    recaps(db, 47, () => '2026-11-20 09:00:00');
    const seen = await walk(env);
    expect(seen).toHaveLength(47);
    expect(new Set(seen).size).toBe(47);
  });

  it('keeps a held piece beyond the six at the top in its place below, and repeats none', async () => {
    const { db, env } = setup();
    recaps(db, 30, i => `2026-11-${String(10 + (i % 15)).padStart(2, '0')} 09:00:${String(i).padStart(2, '0')}`);
    for (let i = 0; i < 9; i += 1) {
      db.sqlite.prepare(`INSERT INTO tea_table_holds (item_kind, item_id, held_by, held_until)
        VALUES ('recap', ?, 'platform-owner', datetime('now', '+3 days'))`).run(`bulk-${String(i).padStart(2, '0')}`);
    }
    const first: any = await table(env);
    expect(first.held).toHaveLength(6);
    const seen = await walk(env);
    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
  });

  it('refuses a cursor that is not one', async () => {
    const { env } = setup();
    expect((await call(env, null, '/api/tea-table?before=2026-11-20%2009%3A00%3A00~nothing')).status).toBe(400);
    expect((await call(env, null, '/api/tea-table?before=2026-11-20')).status).toBe(200);
  });

  it('does not move a tasting forward when it is shared again', async () => {
    const { db, env } = setup();
    await shareToTable(env);
    db.exec(`UPDATE member_tasting_shares SET tea_table_at = '2026-11-15 08:00:00' WHERE journal_entry_id = 'journal-one'`);
    const before = db.sqlite.prepare(`SELECT tea_table_at, tea_table_sittings FROM member_tasting_shares WHERE journal_entry_id = 'journal-one'`).get();
    await shareToTable(env);
    await ok(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'offered', tea_table: true } });
    expect(db.sqlite.prepare(`SELECT tea_table_at, tea_table_sittings FROM member_tasting_shares WHERE journal_entry_id = 'journal-one'`).get())
      .toEqual(before);
  });
});

describe('closed', () => {
  it('answers every Tea Table address exactly as an address that does not exist', async () => {
    const { env } = setup();
    const closed = { ...env, TEA_TABLE_OPEN: 'false' };
    const absent = await call(closed, PLATFORM, '/api/no-such-address');
    const absentText = await absent.text();
    const requests: Array<[string, string, unknown]> = [
      ['GET', '/api/tea-table', undefined], ['GET', '/api/tea-table/me', undefined],
      ['PUT', '/api/tea-table/keeps/recap/event-1', undefined], ['DELETE', '/api/tea-table/keeps/recap/event-1', undefined],
      ['DELETE', '/api/tea-table/mine/tasting/journal-one', undefined],
      ['PUT', '/api/tea-table/holds/recap/event-1', { days: 3 }], ['DELETE', '/api/tea-table/holds/recap/event-1', undefined],
      ['GET', '/api/admin/tea-table', undefined], ['POST', '/api/admin/tea-table/hide', { kind: 'recap', id: 'event-1' }],
      ['GET', '/api/admin/tea-table/recaps/event-1', undefined], ['PUT', '/api/admin/tea-table/recaps/event-1', undefined],
    ];
    for (const [method, path, body] of requests) {
      for (const who of [null, MEMBER, HOST, PLATFORM]) {
        const response = await call(closed, who, path, { method, body });
        expect(response.status, `${method} ${path}`).toBe(404);
        expect(await response.text()).toBe(absentText);
        expect(response.headers.get('Cache-Control')).toBe(absent.headers.get('Cache-Control'));
      }
    }
  });
});
