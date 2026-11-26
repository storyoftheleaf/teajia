import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { tastingWithoutScores } from '../src/publicScores';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// K14 (Adrian, 2026-11-26): a tea score is personal. A person may rate a tea
// for themselves, but the number, and the verdict that stands for it, is shown
// to nobody but the person who gave it. The one exception is a host's own live
// tasting screen during their session (/host-live).
// Driven through worker.fetch against SQLite built from the migration ledger.

const SECRET = 'score-stays-secret';
const SHOP = 'acc-shop';
const OTHER_SHOP = 'acc-other';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'member', accountId: SHOP, role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'editor', accountId: SHOP, role: 'staff', bundles: ['catalog'] });
  seedIdentity(db, { userId: 'manager', accountId: SHOP, role: 'staff', bundles: ['catalog', 'gather'] });
  seedIdentity(db, { userId: 'host', accountId: SHOP, role: 'staff', bundles: ['gather'] });
  seedIdentity(db, { userId: 'other-seller', accountId: OTHER_SHOP, role: 'owner' });
  db.sqlite.exec(`
    UPDATE accounts SET owner_user_id = 'owner' WHERE id = '${SHOP}';
    UPDATE accounts SET owner_user_id = 'other-seller' WHERE id = '${OTHER_SHOP}';
    UPDATE accounts SET is_platform_owner = 1 WHERE id = '${SHOP}';
    UPDATE account_members SET permissions = '{"bundles":["catalog","gather"],"curate_manage":true}'
      WHERE account_id = '${SHOP}' AND user_id = 'manager';
  `);
  // The owner's own score on the shop's tea, and an old list shape that carried a rating.
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams,
      tasting, tasting_notes, catalog_visible, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
    VALUES ('tea-a', ?, 'Oolong', 'Tea A', 'Tea A', 1, 1, 'Active', 100, ?, ?, 1, NULL, NULL, NULL, NULL)`).run(
    SHOP, JSON.stringify({ quality: 8, impression: 'love', aroma: ['orchid'] }), JSON.stringify([{ rating: 8, text: 'Stone fruit' }]),
  );
  // The member's own review, kept to the shop, and another member's network draft.
  db.sqlite.prepare(`INSERT INTO tea_reviews (id, tea_key, product_id, product_account_id, author_user_id, author_account_id,
      visibility, rating, verdict, notes, tasting, status)
    VALUES ('review-mine', 'tea-a-key', 'tea-a', ?, 'member', ?, 'account', 8, 'love', 'Bright and long', ?, 'submitted'),
           ('review-draft', 'tea-a-key', 'tea-a', ?, 'editor', ?, 'network', 6, 'like', 'Still writing', ?, 'draft')`).run(
    SHOP, SHOP, JSON.stringify({ quality: 8, aroma: ['orchid'] }), SHOP, SHOP, JSON.stringify({ quality: 6 }),
  );
  // A sample the manager sourced, tasted by the member.
  db.sqlite.exec(`
    INSERT INTO tea_sample_sets (id, account_id, name, user_id) VALUES ('set-1', '${SHOP}', 'Spring', 'manager');
    INSERT INTO tea_samples (id, account_id, set_id, name, user_id, created_by) VALUES ('s-1', '${SHOP}', 'set-1', 'Yiwu', 'manager', 'admin');
    INSERT INTO tea_sample_tastings (id, sample_id, account_id, taster_id, taster_name, tasting, rating, verdict, would_buy, personal_note)
      VALUES ('t-1', 's-1', '${SHOP}', 'member@test.dev', 'Member', '{"quality":8,"aroma":["orchid"]}', 8, 'love', 1, 'Long finish');
  `);
  // The member's Curate tea, scored, and a shared and a private tasting note on it.
  db.sqlite.prepare(`INSERT INTO tea_compass_entries (id, user_id, account_id, name, tasting, verdict, tea_key)
    VALUES ('entry-m', 'member', ?, 'Member tea', ?, 'love', 'member-key')`).run(SHOP, JSON.stringify({ quality: 8, flavor: ['honey'] }));
  db.sqlite.prepare(`INSERT INTO notes (id, account_id, compass_entry_id, text, source_type, tasting_snapshot, author_id, author_name, visibility)
    VALUES ('note-private', ?, 'entry-m', '8/10 · honey', 'tasting', ?, 'member', 'Member', 'private'),
           ('note-shared', ?, 'entry-m', '8/10 · honey', 'tasting', ?, 'member', 'Member', 'network')`).run(
    SHOP, JSON.stringify({ quality: 8, flavor: ['honey'] }), SHOP, JSON.stringify({ quality: 8, flavor: ['honey'] }),
  );
  // A table card with one vote on it.
  db.sqlite.exec(`
    INSERT INTO table_share_tokens (id, token, source_entry_id, account_id, created_by_user_id, expires_at, created_at)
      VALUES ('tst-1', 'table-1', 'entry-m', '${SHOP}', 'member', '2999-01-01T00:00:00Z', '2026-11-26T00:00:00Z');
    INSERT INTO anonymous_verdicts (id, browser_token, table_token, source_entry_id, verdict, notes, tasting_data, created_at)
      VALUES ('av-1', 'browser-1', 'table-1', 'entry-m', 'love', 'Sweet', '{"quality":9}', '2026-11-26T00:00:00Z');
  `);
  const env = { DB: db as any, JWT_SECRET: SECRET, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } };
  return { db, env };
}

type Who = { userId: string; account?: string } | null;
async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? SHOP, session_version: 0,
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', who.account ?? SHOP);
  }
  let body: BodyInit | undefined;
  if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}
async function read(env: any, who: Who, path: string) {
  const response = await call(env, who, path);
  expect(response.status).toBe(200);
  return await response.json() as any;
}

const OWNER = { userId: 'owner' };
const MEMBER = { userId: 'member' };
const EDITOR = { userId: 'editor' };
const MANAGER = { userId: 'manager' };

describe('the shop score on a tea is the owner\'s', () => {
  it('reaches the owner, and no other member, on the list and the detail', async () => {
    const { env } = setup();
    const ownList = (await read(env, OWNER, '/api/products')).find((p: any) => p.id === 'tea-a');
    expect(ownList.tasting).toMatchObject({ quality: 8, impression: 'love' });
    for (const who of [MEMBER, EDITOR]) {
      const list = (await read(env, who, '/api/products')).find((p: any) => p.id === 'tea-a');
      const detail = await read(env, who, '/api/products/tea-a');
      for (const product of [list, detail]) {
        expect(product.tasting).toEqual({ aroma: ['orchid'] });
        expect(JSON.stringify(product.tasting_notes)).not.toContain('rating');
      }
    }
  });

  it('keeps the owner\'s score when another editor saves the words', async () => {
    const { db, env } = setup();
    const saved = await call(env, EDITOR, '/api/products/tea-a/catalog', { method: 'PUT', body: { tasting: { aroma: ['orchid', 'honey'], quality: 2 } } });
    expect(saved.status).toBeLessThan(300);
    const stored = JSON.parse(String((db.sqlite.prepare('SELECT tasting FROM products WHERE id = ?').get('tea-a') as any).tasting));
    expect(stored).toEqual({ aroma: ['orchid', 'honey'], quality: 8, impression: 'love' });
  });

  it('does not cross to another shop through the catalogue', async () => {
    const { env } = setup();
    const catalog = await read(env, { userId: 'other-seller', account: OTHER_SHOP }, '/api/catalog');
    const tea = (catalog.products ?? catalog).find((p: any) => p.id === 'tea-a');
    expect(tea.tasting).toEqual({ aroma: ['orchid'] });
    expect(JSON.stringify(tea)).not.toMatch(/"quality"|"rating"|"impression"/);
  });

  it('is not read signed out, in any stored shape', async () => {
    const { env } = setup();
    const detail = await read(env, null, `/api/s/${SHOP}/products/tea-a`);
    expect(detail.tasting).toEqual({ aroma: ['orchid'] });
    expect(JSON.stringify(detail.tasting_notes)).not.toContain('rating');
  });
});

describe('a review score is its writer\'s', () => {
  it('reaches the writer; another member and a signed-out reader get the words, and no one else\'s draft', async () => {
    const { env } = setup();
    const own = await read(env, MEMBER, '/api/tea-reviews?tea_key=tea-a-key');
    expect(own.find((r: any) => r.id === 'review-mine')).toMatchObject({ rating: 8, verdict: 'love', tasting: { quality: 8 } });
    expect(own.find((r: any) => r.id === 'review-draft')).toBeUndefined();

    const other = await read(env, OWNER, '/api/tea-reviews?tea_key=tea-a-key');
    const theirs = other.find((r: any) => r.id === 'review-mine');
    expect(theirs).toMatchObject({ notes: 'Bright and long', tasting: { aroma: ['orchid'] } });
    for (const key of ['rating', 'verdict', 'would_buy']) expect(theirs).not.toHaveProperty(key);
    expect(other.find((r: any) => r.id === 'review-draft')).toBeUndefined();

    expect(await read(env, null, '/api/tea-reviews?tea_key=tea-a-key')).toEqual([]);
  });
});

describe('a sample score is its taster\'s', () => {
  it('reaches the taster; the sample\'s owner, sourcing staff and the link read none', async () => {
    const { env } = setup();
    const mine = await read(env, MEMBER, '/api/samples/s-1');
    expect(mine.tastings[0]).toMatchObject({ rating: 8, verdict: 'love' });

    const sourcer = await read(env, MANAGER, '/api/samples/s-1');
    expect(sourcer.tastings[0]).toMatchObject({ personal_note: 'Long finish', tasting: { aroma: ['orchid'] } });
    for (const key of ['rating', 'verdict', 'would_buy']) expect(sourcer.tastings[0]).not.toHaveProperty(key);

    const staff = await read(env, MANAGER, '/api/admin/samples');
    const tasting = staff.samples.find((s: any) => s.id === 's-1').tastings[0];
    for (const key of ['rating', 'verdict', 'would_buy']) expect(tasting).not.toHaveProperty(key);
    expect(tasting.tasting).not.toHaveProperty('quality');

    const link = await read(env, null, '/api/samples/s-1');
    expect(link.tastings).toEqual([{ id: 't-1', created_at: expect.anything() }]);
  });

  it('is not handed back to someone repeating a tasting id they did not write', async () => {
    const { env } = setup();
    const repeat = await call(env, null, '/api/samples/s-1/tastings', { method: 'POST', body: {
      id: 't-1', tasting: { quality: 8, aroma: ['orchid'] }, rating: 8, verdict: 'love', wouldBuy: true, personalNote: 'Long finish',
    } });
    const body = await repeat.json() as any;
    for (const key of ['rating', 'verdict', 'would_buy', 'taster_id']) expect(body).not.toHaveProperty(key);
  });
});

describe('a Curate score is its writer\'s', () => {
  it('reaches the writer; a manager reads the tea without the score or verdict', async () => {
    const { env } = setup();
    const own = (await read(env, MEMBER, '/api/compass/entries')).entries.find((e: any) => e.id === 'entry-m');
    expect(JSON.parse(own.tasting)).toMatchObject({ quality: 8 });
    expect(own.verdict).toBe('love');
    const managed = (await read(env, MANAGER, '/api/compass/entries')).entries.find((e: any) => e.id === 'entry-m');
    expect(JSON.parse(managed.tasting)).toEqual({ flavor: ['honey'] });
    expect(managed.verdict).toBeNull();
  });

  it('keeps the writer\'s score when a manager edits the words', async () => {
    const { db, env } = setup();
    const saved = await call(env, MANAGER, '/api/compass/entries/entry-m', { method: 'PUT', body: { tasting: { flavor: ['honey', 'longan'] }, verdict: 'pass' } });
    expect(saved.status).toBe(200);
    const row = db.sqlite.prepare('SELECT tasting, verdict FROM tea_compass_entries WHERE id = ?').get('entry-m') as any;
    expect(JSON.parse(row.tasting)).toEqual({ flavor: ['honey', 'longan'], quality: 8 });
    expect(row.verdict).toBe('love');
  });

  it('keeps a private note to its writer, and a shared tasting note carries no score', async () => {
    const { env } = setup();
    const own = (await read(env, MEMBER, '/api/notes?compass_entry_id=entry-m')).notes;
    expect(own.map((n: any) => n.id).sort()).toEqual(['note-private', 'note-shared']);
    const other = (await read(env, OWNER, '/api/notes?compass_entry_id=entry-m')).notes;
    expect(other.map((n: any) => n.id)).toEqual(['note-shared']);
    expect(other[0].text).toBe('honey');
    expect(JSON.parse(other[0].tasting_snapshot)).toEqual({ flavor: ['honey'] });
  });

  it('gives Compass feedback with no tally, total or score', async () => {
    const { env } = setup();
    const feedback = await read(env, OWNER, '/api/compass/entries/entry-m/feedback');
    expect(feedback).not.toHaveProperty('counts');
    expect(feedback).not.toHaveProperty('total');
    expect(feedback.table_verdicts).toEqual([{ notes: 'Sweet', created_at: '2026-11-26T00:00:00Z', tasting_data: {} }]);
  });
});

describe('a table card shows no tally', () => {
  it('answers a second link holder without counting anyone\'s vote', async () => {
    const { env } = setup();
    const card = await read(env, null, '/api/t/table-1');
    expect(card).not.toHaveProperty('verdictCounts');
    expect(JSON.stringify(card)).not.toMatch(/love/);
  });
});

describe('a session result', () => {
  it('reaches its giver and the host\'s own live screen, and only that it was given to a peer', async () => {
    const { db, env } = setup();
    seedIdentity(db, { userId: 'peer', accountId: SHOP, role: 'viewer', bundles: [] });
    db.sqlite.exec(`
      INSERT INTO tasting_sessions (id, account_id, created_by_user_id, title, status, invite_token, created_at)
        VALUES ('flight', '${SHOP}', 'host', 'Flight', 'active', 'flight-invite', '2026-11-26');
      INSERT INTO tasting_session_members (id, session_id, user_id, joined_at)
        VALUES ('m-1', 'flight', 'member', '2026-11-26'), ('m-2', 'flight', 'peer', '2026-11-26');
      INSERT INTO tasting_session_teas (id, session_id, tea_name) VALUES ('tea', 'flight', 'Oolong');
    `);
    const given = await call(env, MEMBER, '/api/sessions/flight/teas/tea/verdict', { method: 'POST', body: { verdict: 'love', tasting_data: { quality: 9 } } });
    expect(given.status).toBe(200);

    const peer = await read(env, { userId: 'peer' }, '/api/sessions/flight/verdicts');
    expect(peer.verdicts).toEqual([expect.objectContaining({ user_id: 'member', session_tea_id: 'tea' })]);
    expect(JSON.stringify(peer)).not.toMatch(/love|"quality"/);

    const giver = await read(env, MEMBER, '/api/sessions/flight/verdicts');
    expect(giver.verdicts[0]).toMatchObject({ verdict: 'love', tasting_data: { quality: 9 } });
    const live = await read(env, { userId: 'host' }, '/api/sessions/flight/host-live');
    expect(live.verdicts[0]).toMatchObject({ verdict: 'love', tasting_data: { quality: 9 } });
  });
});

describe('the scrubber', () => {
  it('takes scores out of lists and nested shapes, and keeps the words', () => {
    expect(tastingWithoutScores([{ rating: 8, text: 'Stone fruit' }, 'Orchid'])).toEqual([{ text: 'Stone fruit' }, 'Orchid']);
    expect(tastingWithoutScores({ quality: 8, impression: 'pass', verdict: 'love', notes: [{ text: 'a', rating: 3 }] }))
      .toEqual({ notes: [{ text: 'a' }] });
    expect(tastingWithoutScores(null)).toBeNull();
    expect(tastingWithoutScores('8/10')).toBe('8/10');
  });
});
