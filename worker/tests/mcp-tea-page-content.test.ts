import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { combineToolModules } from '../src/mcpTools/registry';
import { teaPageContentTools, __testables } from '../src/mcpTools/teaPageContent';

/*
 * The tea page content tools let an agent do what the owner does on a tea
 * page: curator's notes, customer excerpts and customer photographs. What can
 * go wrong silently, and is covered here: another shop's row acted on, a write
 * that drops the notes nobody named, a curator note turning supplier words into
 * the shop's claim, and a confirmation spent on something it did not preview.
 */

const SHOP = 'acc-page';
const OTHER = 'acc-elsewhere';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

type AnyResult = Record<string, any>;

function makeDb() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other-owner', accountId: OTHER, role: 'owner' });
  db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES ('guest', 'guest@test.dev', 'Mei', 'x', 'user', 0)`).run();
  return db;
}

function seedProduct(db: SqliteD1, id: string, opts: { account?: string; tasting?: string | null; source?: string | null } = {}) {
  db.sqlite.prepare(
    `INSERT INTO products (id, account_id, type, product_name, given_name, tasting, tasting_source) VALUES (?, ?, 'Oolong', ?, ?, ?, ?)`
  ).run(id, opts.account ?? SHOP, `Tea ${id}`, `Tea ${id}`, opts.tasting ?? null, opts.source ?? null);
}

const owner = (over: Record<string, string> = {}) => ({
  accountId: SHOP, userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'tok-page', creatorTier: 'account_owner', ...over,
}) as any;

const call = (db: SqliteD1, name: string, args: any, who = owner()): Promise<AnyResult> =>
  teaPageContentTools.handlers[name]({ DB: db } as any, who, args) as Promise<AnyResult>;

async function twoStep(db: SqliteD1, name: string, args: any, who = owner()) {
  const preview = await call(db, name, args, who);
  if (!preview.confirmation_token) return { preview, committed: preview };
  const committed = await call(db, name, { ...args, confirm: preview.confirmation_token }, who);
  return { preview, committed };
}

const productRow = (db: SqliteD1, id: string) =>
  db.sqlite.prepare('SELECT tasting, tasting_source FROM products WHERE id = ?').get(id) as { tasting: string | null; tasting_source: string | null };

describe('registration and authority', () => {
  it('registers every tool, writes on catalog:write and lists on inventory:read', () => {
    const { defs } = combineToolModules([teaPageContentTools]);
    const scope = Object.fromEntries(defs.map(d => [d.name, d.scope]));
    expect(scope).toEqual({
      set_curator_notes: 'catalog:write',
      list_tasting_excerpts: 'inventory:read',
      approve_tasting_excerpt: 'catalog:write',
      dismiss_tasting_excerpt: 'catalog:write',
      set_tasting_excerpt_placement: 'catalog:write',
      list_offered_photographs: 'inventory:read',
      set_photograph_use: 'catalog:write',
    });
  });

  it('keeps customer words and photographs from a staff token that holds inventory:read', async () => {
    const db = makeDb();
    const staff = owner({ creatorTier: 'staff' });
    expect((await call(db, 'list_tasting_excerpts', {}, staff)).error).toBe('owner_tier_required');
    expect((await call(db, 'list_offered_photographs', {}, staff)).error).toBe('owner_tier_required');
  });
});

describe('set_curator_notes', () => {
  const stored = {
    flavor: ['honey'],
    teaser: 'A forest oolong.',
    notes: [
      'legacy plain note',
      { id: 'cur-1', text: 'Slow to leave.', starred: true, section: 'finish', capturedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'draft', text: 'Unstarred draft.', section: 'general' },
      { id: 'comm', text: 'A guest said this.', starred: true, sourceAuthor: { initial: 'M' } },
      { id: 'jour', text: 'From a journal.', starred: true, sourceJournalEntryId: 'j-1' },
      { id: 'cur-2', text: 'Old line to drop.', starred: true },
    ],
  };

  it('replaces only the curator notes, keeps the rest and keeps an owner source', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-a', { tasting: JSON.stringify(stored), source: 'owner' });
    const { preview, committed } = await twoStep(db, 'set_curator_notes', { product_id: 'tea-a', notes: [' Slow to leave. ', 'A new line.'] });
    expect(preview.preview.curator_notes).toEqual({ before: ['Slow to leave.', 'Old line to drop.'], after: ['Slow to leave.', 'A new line.'] });
    expect(committed).toMatchObject({ committed: true, tasting_source: 'owner' });

    const row = productRow(db, 'tea-a');
    expect(row.tasting_source).toBe('owner');
    const next = JSON.parse(row.tasting!);
    expect(next.flavor).toEqual(['honey']);
    expect(next.teaser).toBe('A forest oolong.');
    const notes = next.notes as any[];
    expect(notes[0]).toBe('legacy plain note');
    // The unchanged line keeps its id, capture time and section.
    expect(notes[1]).toEqual(stored.notes[1]);
    expect(notes[2]).toMatchObject({ text: 'A new line.', starred: true, section: 'general' });
    expect(notes[2].id).not.toBe('cur-2');
    expect(notes.slice(3)).toEqual([stored.notes[2], stored.notes[3], stored.notes[4]]);
    expect(notes.some(n => n?.text === 'Old line to drop.')).toBe(false);
  });

  it('an empty array clears the curator notes and nothing else', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-a', { tasting: JSON.stringify(stored), source: 'owner' });
    await twoStep(db, 'set_curator_notes', { product_id: 'tea-a', notes: [] });
    const notes = JSON.parse(productRow(db, 'tea-a').tasting!).notes as any[];
    expect(notes).toEqual([stored.notes[0], stored.notes[2], stored.notes[3], stored.notes[4]]);
  });

  it('refuses supplier or potential-profile terms rather than promoting them', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-src', { tasting: JSON.stringify(stored), source: 'source' });
    seedProduct(db, 'tea-null-terms', { tasting: JSON.stringify(stored), source: null });
    for (const id of ['tea-src', 'tea-null-terms']) {
      const result = await call(db, 'set_curator_notes', { product_id: id, notes: ['Mine.'] });
      expect(result.error).toBe('tasting_not_owned_by_shop');
      expect(result.confirmation_token).toBeUndefined();
    }
    expect(productRow(db, 'tea-src')).toEqual({ tasting: JSON.stringify(stored), tasting_source: 'source' });
  });

  it('stamps owner when there is no tasting claim at all', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-blank', { tasting: JSON.stringify({ teaser: 'Kept.' }), source: null });
    const { committed } = await twoStep(db, 'set_curator_notes', { product_id: 'tea-blank', notes: ['First line.'] });
    expect(committed.committed).toBe(true);
    const row = productRow(db, 'tea-blank');
    expect(row.tasting_source).toBe('owner');
    expect(JSON.parse(row.tasting!)).toMatchObject({ teaser: 'Kept.', notes: [{ text: 'First line.', starred: true }] });
  });

  it('refuses an unreadable tasting, empty strings and another shop\'s tea', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-bad', { tasting: '{ not json', source: 'owner' });
    seedProduct(db, 'tea-theirs', { account: OTHER, tasting: '{}', source: 'owner' });
    expect((await call(db, 'set_curator_notes', { product_id: 'tea-bad', notes: ['x'] })).error).toBe('stored_tasting_unreadable');
    expect(productRow(db, 'tea-bad').tasting).toBe('{ not json');
    expect((await call(db, 'set_curator_notes', { product_id: 'tea-bad', notes: ['ok', '  '] })).error).toBe('empty_note_refused');
    expect((await call(db, 'set_curator_notes', { product_id: 'tea-theirs', notes: ['x'] })).error).toBe('product_not_found');
  });

  it('refuses a confirm when the tasting changed after the preview', async () => {
    const db = makeDb();
    seedProduct(db, 'tea-a', { tasting: JSON.stringify(stored), source: 'owner' });
    const preview = await call(db, 'set_curator_notes', { product_id: 'tea-a', notes: ['New.'] });
    db.sqlite.prepare(`UPDATE products SET tasting = ? WHERE id = 'tea-a'`).run(JSON.stringify({ ...stored, teaser: 'Edited in the admin.' }));
    const result = await call(db, 'set_curator_notes', { product_id: 'tea-a', notes: ['New.'], confirm: preview.confirmation_token });
    expect(result.error).toBe('tasting_changed_since_preview');
    expect(JSON.parse(productRow(db, 'tea-a').tasting!).teaser).toBe('Edited in the admin.');
  });

  it('treats a non-object stored tasting as unreadable', () => {
    expect('error' in __testables.readTastingStrict('[1,2]')).toBe(true);
    expect('error' in __testables.readTastingStrict('{"notes":"oops"}')).toBe(true);
    expect(__testables.readTastingStrict(null)).toEqual({ tasting: {}, notes: [] });
  });
});

function seedOffer(db: SqliteD1, id: string, opts: { account?: string; product?: string; status?: string } = {}) {
  const account = opts.account ?? SHOP;
  const product = opts.product ?? 'tea-a';
  db.sqlite.prepare(`INSERT OR IGNORE INTO customer_tasting_journal (id, account_id, user_id, product_id) VALUES (?, ?, 'guest@test.dev', ?)`)
    .run(`journal-${product}`, account, product);
  db.sqlite.prepare(`
    INSERT INTO tasting_note_candidates
      (id, account_id, journal_entry_id, note_key, product_id, author_user_id, source_text, status, attribution_name, offered_at)
    VALUES (?, ?, ?, ?, ?, 'guest', 'Orchid over warm stone', ?, 'M.', '2026-11-20T00:00:00.000Z')
  `).run(id, account, `journal-${product}`, `sitting-${id}`, product, opts.status ?? 'starred');
}

describe('tasting excerpts', () => {
  function setup() {
    const db = makeDb();
    seedProduct(db, 'tea-a');
    seedProduct(db, 'tea-theirs', { account: OTHER });
    seedOffer(db, 'offer-1');
    seedOffer(db, 'offer-2');
    seedOffer(db, 'offer-theirs', { account: OTHER, product: 'tea-theirs' });
    return db;
  }

  it('lists only this shop\'s offers, grouped by tea', async () => {
    const db = setup();
    const listed = await call(db, 'list_tasting_excerpts', {});
    expect(listed.products).toHaveLength(1);
    expect(listed.products[0]).toMatchObject({ product_id: 'tea-a', product_name: 'Tea tea-a' });
    expect(listed.products[0].waiting.map((e: any) => e.excerpt_id).sort()).toEqual(['offer-1', 'offer-2']);
  });

  it('approves as offered, then shows it on the listing and the homepage', async () => {
    const db = setup();
    const { preview, committed } = await twoStep(db, 'approve_tasting_excerpt', { excerpt_id: 'offer-1' });
    expect(preview.preview).toMatchObject({ text: 'Orchid over warm stone', byline: 'M.' });
    expect(committed).toMatchObject({ committed: true, status: 'promoted', showOnListing: false, showOnMainPage: false });
    const candidate = db.sqlite.prepare(`SELECT status FROM tasting_note_candidates WHERE id = 'offer-1'`).get() as any;
    expect(candidate.status).toBe('promoted');

    const impressionId = committed.id as string;
    const placed = await twoStep(db, 'set_tasting_excerpt_placement', { impression_id: impressionId, show_on_listing: true, show_on_homepage: true });
    expect(placed.preview.preview.show_on_listing).toEqual({ before: false, after: true });
    expect(placed.committed).toMatchObject({ committed: true, show_on_listing: true, show_on_homepage: true });
    const row = db.sqlite.prepare('SELECT show_on_listing, show_on_main_page FROM product_impressions WHERE id = ?').get(impressionId) as any;
    expect(row).toEqual({ show_on_listing: 1, show_on_main_page: 1 });

    const listed = await call(db, 'list_tasting_excerpts', { status: 'approved' });
    expect(listed.products[0].approved[0]).toMatchObject({ impression_id: impressionId, show_on_listing: true, show_on_homepage: true });
  });

  it('refuses changed words, as the admin route does', async () => {
    const db = setup();
    const result = await call(db, 'approve_tasting_excerpt', { excerpt_id: 'offer-1', text: 'Something else' });
    expect(result.error).toBe('only_the_customer_can_change_the_words');
  });

  it('passes on an offer', async () => {
    const db = setup();
    const { committed } = await twoStep(db, 'dismiss_tasting_excerpt', { excerpt_id: 'offer-2' });
    expect(committed).toMatchObject({ committed: true, success: true });
    const row = db.sqlite.prepare(`SELECT status, dismissed_by FROM tasting_note_candidates WHERE id = 'offer-2'`).get() as any;
    expect(row).toEqual({ status: 'dismissed', dismissed_by: 'owner' });
  });

  it('treats another shop\'s offer and excerpt as not found', async () => {
    const db = setup();
    expect((await call(db, 'approve_tasting_excerpt', { excerpt_id: 'offer-theirs' })).error).toBe('excerpt_not_found');
    expect((await call(db, 'dismiss_tasting_excerpt', { excerpt_id: 'offer-theirs' })).error).toBe('excerpt_not_found');
    // Approved in its own shop, then reached for from this one.
    const theirs = await twoStep(db, 'approve_tasting_excerpt', { excerpt_id: 'offer-theirs' },
      owner({ accountId: OTHER, userId: 'other-owner', tokenId: 'tok-theirs' }));
    const result = await call(db, 'set_tasting_excerpt_placement', { impression_id: theirs.committed.id, show_on_listing: true });
    expect(result.error).toBe('approved_excerpt_not_found');
    const status = db.sqlite.prepare(`SELECT status FROM tasting_note_candidates WHERE id = 'offer-theirs'`).get() as any;
    expect(status.status).toBe('promoted');
  });

  it('will not spend a placement ticket on different placements', async () => {
    const db = setup();
    const approved = await twoStep(db, 'approve_tasting_excerpt', { excerpt_id: 'offer-1' });
    const preview = await call(db, 'set_tasting_excerpt_placement', { impression_id: approved.committed.id, show_on_listing: true });
    const result = await call(db, 'set_tasting_excerpt_placement', { impression_id: approved.committed.id, show_on_homepage: true, confirm: preview.confirmation_token });
    expect(result.error).toBe('invalid_or_expired_confirmation_token');
  });
});

function seedPhoto(db: SqliteD1, id: string, opts: { account?: string; product?: string; offered?: boolean; use?: string } = {}) {
  db.sqlite.prepare(`
    INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
      full_width, full_height, small_width, small_height, share_state, offered_at, shop_use)
    VALUES (?, ?, ?, 'guest', ?, ?, 10, 5, 2000, 2000, 600, 600, ?, ?, ?)
  `).run(id, opts.account ?? SHOP, opts.product ?? 'tea-a', `family-photos/${id}.jpg`, `family-photos/${id}-s.jpg`,
    opts.offered === false ? 'private' : 'offered', opts.offered === false ? null : '2026-11-20 00:00:00', opts.use ?? 'none');
}

describe('customer photographs', () => {
  function setup() {
    const db = makeDb();
    seedProduct(db, 'tea-a');
    seedProduct(db, 'tea-theirs', { account: OTHER });
    seedPhoto(db, 'photo-1');
    seedPhoto(db, 'photo-2', { use: 'lead' });
    seedPhoto(db, 'photo-private', { offered: false });
    seedPhoto(db, 'photo-theirs', { account: OTHER, product: 'tea-theirs' });
    return db;
  }
  const use = (db: SqliteD1, id: string) => (db.sqlite.prepare('SELECT shop_use FROM member_photographs WHERE id = ?').get(id) as any).shop_use;

  it('lists this shop\'s offered photographs with unsigned addresses only', async () => {
    const db = setup();
    const listed = await call(db, 'list_offered_photographs', {});
    expect(listed.photographs.map((p: any) => p.id).sort()).toEqual(['photo-1', 'photo-2']);
    for (const photo of listed.photographs) {
      expect(photo.full_url).not.toContain('sig=');
      expect(photo.small_url).not.toContain('sig=');
    }
  });

  it('places a photograph, and lead steps the previous lead back', async () => {
    const db = setup();
    const placed = await twoStep(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'place' });
    expect(placed.committed).toMatchObject({ committed: true, photograph: { id: 'photo-1', shop_use: 'placed' } });
    expect(use(db, 'photo-1')).toBe('placed');

    const lead = await twoStep(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'lead' });
    expect(lead.preview.preview.current_lead_steps_back).toBe('photo-2');
    expect(use(db, 'photo-1')).toBe('lead');
    expect(use(db, 'photo-2')).toBe('none');

    await twoStep(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'restore' });
    expect(use(db, 'photo-1')).toBe('placed');
    await twoStep(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'pass' });
    expect(use(db, 'photo-1')).toBe('passed');
  });

  it('refuses another shop\'s photograph and one never offered', async () => {
    const db = setup();
    expect((await call(db, 'set_photograph_use', { photograph_id: 'photo-theirs', action: 'place' })).error).toBe('photograph_not_found');
    expect(use(db, 'photo-theirs')).toBe('none');
    expect((await call(db, 'set_photograph_use', { photograph_id: 'photo-private', action: 'place' })).error).toBe('not_offered');
    expect((await call(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'hide' })).error).toBe('action_must_be_place_lead_pass_or_restore');
  });

  it('will not spend a ticket previewed for a different action', async () => {
    const db = setup();
    const preview = await call(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'place' });
    const result = await call(db, 'set_photograph_use', { photograph_id: 'photo-1', action: 'lead', confirm: preview.confirmation_token });
    expect(result.error).toBe('invalid_or_expired_confirmation_token');
    expect(use(db, 'photo-1')).toBe('none');
  });
});
