import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// Teajia family, stage 4 (todo/plans/teajia-family.md): what a person's page
// shows of their tastings, the owner's hides, sold-out teas and the people
// list's "The family" ordering. Driven through worker.fetch against a real
// SQLite database built from worker/schema.sql.

const SHOP = 'acc_teajia_bali';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  for (const id of ['member-one', 'member-two', 'member-three']) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
      .run(id, `${id}@test.dev`, id);
  }
  const product = (id: string, opts: { isPublic?: number; status?: string; stock?: number } = {}) =>
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams)
      VALUES (?, ?, 'Oolong', ?, ?, ?, ?, ?)`).run(id, SHOP, `Tea ${id}`, `Tea ${id}`, opts.isPublic ?? 1, opts.status ?? 'Active', opts.stock ?? 100);
  product('tea-a'); product('tea-b'); product('tea-c');
  product('tea-gone', { status: 'Sold Out', stock: 0 });
  product('tea-unlisted', { isPublic: 0 });
  const contributor = (id: string, userId: string, tier: string | null) =>
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, portrait_url) VALUES (?, ?, ?, ?, 1, ?, ?)`)
      .run(id, SHOP, userId, `Name ${id}`, tier, `${id}.jpg`); // a photograph each: the list leaves out people without one
  contributor('mei', 'member-one', 'family');
  contributor('li', 'member-two', 'family');
  contributor('quiet', 'member-three', 'family');
  // Private journal rows: a score, a verdict and a private note that must never reach a page.
  const journal = (id: string, email: string, productId: string, notes: unknown[]) =>
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
      VALUES (?, NULL, ?, ?, ?, 9, ?, ?)`).run(
      id, email, productId, `Tea ${productId}`,
      JSON.stringify({ rating: 9, verdict: 'love', personalNote: 'PRIVATE-NOTE-TEXT', tasting: {}, updatedAt: '2026-11-19T00:00:00Z' }),
      JSON.stringify([
        { id: 's1', createdAt: '2026-11-10T08:00:00Z', tasting: { rating: 9, notes: notes.slice(0, 1) } },
        { id: 's2', createdAt: '2026-11-18T08:00:00Z', tasting: { notes: notes.slice(1) } },
      ]),
    );
  journal('j-a', 'member-one@test.dev', 'tea-a', [{ id: 'n1', text: 'Orchid and warm stone', capturedAt: '2026-11-10T08:05:00Z' }, 'Sweeter on the second day', { id: 'n3', text: 'Promoted from someone else', sourceAuthor: { initial: 'K' } }]);
  journal('j-b', 'member-one@test.dev', 'tea-b', ['Not shared words']);
  journal('j-gone', 'member-one@test.dev', 'tea-gone', ['Lovely while it lasted']);
  journal('j-c', 'member-one@test.dev', 'tea-c', ['Hidden by the owner']);
  journal('j-li', 'member-two@test.dev', 'tea-a', ['Li found cedar']);
  journal('j-unlisted', 'member-one@test.dev', 'tea-unlisted', ['Withdrawn tea']);
  const share = (journalId: string, userId: string, productId: string, state: string, at: string) =>
    db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(journalId, SHOP, productId, userId, state, at, at);
  share('j-a', 'member-one', 'tea-a', 'page', '2026-11-12 10:00:00');
  share('j-b', 'member-one', 'tea-b', 'private', '2026-11-12 10:00:00');
  share('j-gone', 'member-one', 'tea-gone', 'offered', '2026-11-13 10:00:00');
  share('j-c', 'member-one', 'tea-c', 'page', '2026-11-14 10:00:00');
  share('j-li', 'member-two', 'tea-a', 'page', '2026-11-16 10:00:00');
  share('j-unlisted', 'member-one', 'tea-unlisted', 'page', '2026-11-15 10:00:00');
  const photo = (id: string, userId: string, productId: string, state: string, removed: string | null = null) =>
    db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
      full_width, full_height, small_width, small_height, share_state, removed_by_member_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 900000, 90000, 2000, 1500, 480, 360, ?, ?, '2026-11-12 10:00:00')`).run(
      id, SHOP, productId, userId, `family-photos/${SHOP}/${productId}/${id}-full.jpg`, `family-photos/${SHOP}/${productId}/${id}-small.jpg`, state, removed);
  photo('p-shared', 'member-one', 'tea-a', 'page');
  photo('p-offered', 'member-one', 'tea-a', 'offered');
  photo('p-private', 'member-one', 'tea-a', 'private');
  photo('p-removed', 'member-one', 'tea-a', 'page', '2026-11-13 00:00:00');
  photo('p-only', 'member-one', 'tea-b', 'page');
  return { db, env: { DB: db as any } };
}

async function get(env: any, path: string) {
  return worker.fetch(new Request(`https://worker.test${path}`), env);
}
const hide = (db: SqliteD1, kind: string, id: string) =>
  db.sqlite.prepare(`INSERT INTO family_hides (account_id, target_kind, target_id, hidden_by) VALUES (?, ?, ?, 'owner')`).run(SHOP, kind, id);

describe('a person page shows what they shared', () => {
  it('lists shared tastings with dated words and small photographs, newest first', async () => {
    const { env } = setup();
    const body = await (await get(env, '/api/people/mei')).json() as any;
    expect(body.page_tier).toBe('family');
    const names = body.tastings.map((t: any) => t.product_id);
    expect(names).toEqual(['tea-c', 'tea-gone', 'tea-a', 'tea-b']);
    const a = body.tastings.find((t: any) => t.product_id === 'tea-a');
    expect(a.words.map((w: any) => w.text)).toEqual(['Orchid and warm stone', 'Sweeter on the second day']);
    expect(a.words[0].date).toBe('2026-11-10T08:05:00Z');
    expect(a.words[1].date).toBe('2026-11-18T08:00:00Z');
    expect(a.photographs.map((p: any) => p.id).sort()).toEqual(['p-offered', 'p-shared']);
    expect(a.photographs[0].small_url).toContain('-small.jpg');
    expect(a.public_path).toMatch(/^\/shop\/product\/tea-a\?store=/);
  });

  it('removes shared words and photographs when their tea leaves the shop', async () => {
    const { db, env } = setup();
    db.exec("UPDATE products SET shown_in_shop = 0 WHERE id IN ('tea-a', 'tea-b')");
    const page = await (await get(env, '/api/people/mei')).json() as any;
    expect(page.tastings.map((t: any) => t.product_id)).toEqual(['tea-c', 'tea-gone']);
  });

  it('never carries a score, a verdict or a private note, and leaves out private tastings, removed photographs and withdrawn teas', async () => {
    const { env } = setup();
    const text = await (await get(env, '/api/people/mei')).text();
    for (const secret of ['PRIVATE-NOTE-TEXT', 'verdict', 'love', 'personalNote', '"rating"', 'Not shared words', 'Withdrawn tea', 'p-private', 'p-removed']) {
      expect(text, secret).not.toContain(secret);
    }
    const body = JSON.parse(text);
    const ids = body.tastings.map((t: any) => t.product_id);
    expect(ids).not.toContain('tea-unlisted');
    // A photograph shared on its own still shows its tea.
    expect(ids).toContain('tea-b');
    expect(body.tastings.find((t: any) => t.product_id === 'tea-b').words).toEqual([]);
  });

  it('keeps a sold-out tea, marked as gone', async () => {
    const { env } = setup();
    const body = await (await get(env, '/api/people/mei')).json() as any;
    const gone = body.tastings.find((t: any) => t.product_id === 'tea-gone');
    expect(gone.sold_out).toBe(true);
    expect(gone.words[0].text).toBe('Lovely while it lasted');
    expect(body.tastings.find((t: any) => t.product_id === 'tea-a').sold_out).toBe(false);
  });

  it('honours the owner hides: one tasting, one photograph, a whole page', async () => {
    const { db, env } = setup();
    hide(db, 'tasting', 'j-c');
    hide(db, 'photograph', 'p-shared');
    let body = await (await get(env, '/api/people/mei')).json() as any;
    expect(body.tastings.map((t: any) => t.product_id)).not.toContain('tea-c');
    expect(body.tastings.find((t: any) => t.product_id === 'tea-a').photographs.map((p: any) => p.id)).toEqual(['p-offered']);

    hide(db, 'page', 'mei');
    expect((await get(env, '/api/people/mei')).status).toBe(404);
    const list = await (await get(env, '/api/people')).json() as any;
    expect(list.contributors.map((c: any) => c.id)).not.toContain('mei');
    expect((await get(env, '/api/public/people/mei/favorites')).status).toBe(404);
    // Someone else's page is untouched.
    body = await (await get(env, '/api/people/li')).json() as any;
    expect(body.tastings).toHaveLength(1);
  });
});

describe('the people list: the family', () => {
  it('gives each person the newest moment they shared, null for those who shared nothing', async () => {
    const { env } = setup();
    const list = await (await get(env, '/api/people')).json() as any;
    const byId = Object.fromEntries(list.contributors.map((c: any) => [c.id, c]));
    expect(byId.mei.page_tier).toBe('family');
    expect(byId.mei.family_last_active).toBe('2026-11-15 10:00:00');
    expect(byId.li.family_last_active).toBe('2026-11-16 10:00:00');
    expect(byId.quiet.family_last_active).toBeNull();
    expect(byId.mei.role).toBe('Teajia family');
  });

  it('stops counting a tasting the owner hid', async () => {
    const { db, env } = setup();
    hide(db, 'tasting', 'j-c');
    hide(db, 'tasting', 'j-unlisted');
    const list = await (await get(env, '/api/people')).json() as any;
    expect(list.contributors.find((c: any) => c.id === 'mei').family_last_active).toBe('2026-11-13 10:00:00');
  });
});

describe('a sold-out tea in the selection and favourites stays, marked as gone', () => {
  it('keeps it with its product id so "find me more" can ask for it', async () => {
    const { db, env } = setup();
    db.sqlite.prepare(`INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible)
      VALUES ('prof-gone', 'prof-gone', ?, ?, 'Gone tea', 'published', 1)`).run(SHOP, SHOP);
    db.sqlite.prepare(`INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
      VALUES ('listing-gone', ?, 'prof-gone', 'tea-gone', 'active', 1, 1, 0)`).run(SHOP);
    db.sqlite.prepare(`UPDATE products SET shown_in_shop = 1 WHERE id = 'tea-gone'`).run();
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, position, is_public) VALUES ('mei', 'prof-gone', 0, 1)`).run();
    const page = await (await get(env, '/api/people/mei')).json() as any;
    expect(page.tea_selection).toHaveLength(1);
    expect(page.tea_selection[0]).toMatchObject({ product_id: 'tea-gone', sold_out: true });
    const favorites = await (await get(env, '/api/public/people/mei/favorites')).json() as any;
    expect(favorites.favorites[0]).toMatchObject({ product_id: 'tea-gone' });
    expect(Number(favorites.favorites[0].sold_out)).toBe(1);
  });
});
