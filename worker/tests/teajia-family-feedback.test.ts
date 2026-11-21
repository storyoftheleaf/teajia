import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { csvCell, feedbackFromRow, sheetRange, sheetCsv } from '../src/familyFeedback';

// Teajia family, stage 6 (todo/plans/teajia-family.md): what the shop reads of
// its members' notes, the day sheet, and described reports. Driven through
// worker.fetch against a real SQLite database built from worker/schema.sql.

const SECRET = 'family-secret';
const SHOP = 'acc_teajia_bali';
const OTHER_SHOP = 'acc-other';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other-owner', accountId: OTHER_SHOP, role: 'owner' });
  for (const id of ['member-one', 'member-two']) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
      .run(id, `${id}@test.dev`, id === 'member-one' ? 'Mei' : 'Li');
  }
  const product = (id: string, account: string) =>
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams)
      VALUES (?, ?, 'Oolong', ?, ?, 1, 'Active', 100)`).run(id, account, `Tea ${id}`, `Tea ${id}`);
  product('tea-a', SHOP);
  product('tea-b', SHOP);
  product('tea-elsewhere', OTHER_SHOP);
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links)
    VALUES ('mei-page', ?, 'Mei Lin', 'member-one', 1, '[]')`).run(SHOP);

  // Mei: no account on the journal row at all (a member with no shop), a score
  // of nine and a love. One note was written today, one on an earlier sitting.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings, created_at)
    VALUES ('journal-mei', NULL, 'member-one@test.dev', 'tea-a', 'Tea tea-a', 9, ?, ?, '2026-11-10 08:00:00')`).run(
    JSON.stringify({
      verdict: 'love', updatedAt: '2026-11-19T09:00:00Z',
      // The journal was saved today, but one of its notes was written a week ago and keeps its own day.
      tasting: { notes: [
        { id: 'n-prior', text: 'Smoky the week before', capturedAt: '2026-11-12T09:00:00Z' },
        { id: 'n-today', text: 'Orchid and wet stone', capturedAt: '2026-11-19T09:00:00Z' },
      ] },
    }),
    JSON.stringify([
      { id: 's1', createdAt: '2026-11-18T08:00:00Z', tasting: { notes: [{ id: 'n-old', text: 'Sweet on the second steep', capturedAt: '2026-11-18T08:00:00Z' }] } },
      { id: 's2', createdAt: '2026-11-19T09:00:00Z', tasting: { notes: [{ id: 'n-today', text: 'Orchid and wet stone', capturedAt: '2026-11-19T09:00:00Z' }] } },
    ]),
  );
  // Li: a formula in her words, a comma, a quote and a line break, and a score of four.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, created_at)
    VALUES ('journal-li', ?, 'member-two@test.dev', 'tea-b', 'Tea tea-b', 4, ?, '2026-11-19 10:00:00')`).run(
    SHOP,
    JSON.stringify({
      verdict: 'pass', updatedAt: '2026-11-19T10:00:00Z',
      // The same words also sit as the personal note, as the tasting screen saves them.
      personalNote: '=HYPERLINK("x"), thin,\nflat',
      tasting: { notes: [{ id: 'n-li', text: '=HYPERLINK("x"), thin,\nflat', capturedAt: '2026-11-19T10:00:00Z' }] },
    }),
  );
  // A note about another shop's tea must never reach this shop.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, note)
    VALUES ('journal-else', ?, 'member-one@test.dev', 'tea-elsewhere', 'Elsewhere', ?)`).run(
    OTHER_SHOP,
    JSON.stringify({ verdict: 'like', updatedAt: '2026-11-19T11:00:00Z', tasting: { notes: [{ id: 'x', text: 'Belongs to the other shop', capturedAt: '2026-11-19T11:00:00Z' }] } }),
  );
  return { db, env: { DB: db as any, JWT_SECRET: SECRET, PROVIDER_LIMITER: { limit: async () => ({ success: true }) } } };
}

type Who = { userId: string; account?: string } | null;
const OWNER = { userId: 'owner', account: SHOP };
const OTHER_OWNER = { userId: 'other-owner', account: OTHER_SHOP };
const MEMBER = { userId: 'member-one' };

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

describe('GET /api/admin/family/feedback', () => {
  it('lists every note about this shop\'s teas with the member\'s impression and score, to the shop only', async () => {
    const { env } = setup();
    const response = await call(env, OWNER, '/api/admin/family/feedback');
    expect(response.status).toBe(200);
    const { notes } = await response.json() as any;
    const byText = Object.fromEntries(notes.map((n: any) => [n.text, n]));
    // Found even though Mei's journal row has no account: the tea is the shop's.
    expect(byText['Orchid and wet stone']).toMatchObject({
      product_name: 'Tea tea-a', author_name: 'Mei Lin', page_id: 'mei-page', impression: 'love', rating: 9, shared: false,
    });
    // An earlier dated sitting is a note too, listed once, not decidable here.
    expect(byText['Sweet on the second steep']).toMatchObject({ note_key: 'sitting-0', status: 'open', rating: 9 });
    expect(notes.filter((n: any) => n.text === 'Orchid and wet stone')).toHaveLength(1);
    expect(byText['Smoky the week before'].written_at).toBe('2026-11-12T09:00:00Z');
    expect(byText['=HYPERLINK("x"), thin,\nflat']).toMatchObject({ impression: 'pass', rating: 4, author_name: 'Li' });
    // One piece of writing saved as both the personal note and a dated note is one row.
    expect(notes.filter((n: any) => n.author_name === 'Li')).toHaveLength(1);
    // Tenancy: the other shop's note is not here, and the other shop sees only its own.
    expect(notes.some((n: any) => n.text.includes('other shop'))).toBe(false);
    const other = await (await call(env, OTHER_OWNER, '/api/admin/family/feedback')).json() as any;
    expect(other.notes.map((n: any) => n.text)).toEqual(['Belongs to the other shop']);
    // Newest first.
    expect(notes.map((n: any) => n.written_at)).toEqual([...notes.map((n: any) => n.written_at)].sort().reverse());
  });

  it('is closed to members and to signed-out callers', async () => {
    const { env } = setup();
    expect((await call(env, MEMBER, '/api/admin/family/feedback')).status).toBe(403);
    expect((await call(env, null, '/api/admin/family/feedback')).status).toBe(401);
    expect((await call(env, MEMBER, '/api/admin/family/sheet')).status).toBe(403);
    expect((await call(env, null, '/api/admin/family/sheet')).status).toBe(401);
  });

  it('never lets the score out on a public read', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at)
      VALUES ('journal-mei', ?, 'tea-a', 'member-one', 'page', datetime('now'))`).run(SHOP);
    const page = await (await call(env, null, '/api/people/mei-page')).text();
    expect(page).toContain('Orchid and wet stone');
    expect(page).not.toMatch(/"rating"|"verdict"|"impression"|love/i);
  });

  it('marks a tasting and a page as hidden once the shop has hidden them', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at)
      VALUES ('journal-mei', ?, 'tea-a', 'member-one', 'page', datetime('now'))`).run(SHOP);
    const read = async () => ((await (await call(env, OWNER, '/api/admin/family/feedback')).json()) as any).notes
      .find((n: any) => n.text === 'Orchid and wet stone');
    expect(await read()).toMatchObject({ shared: true, tasting_hidden: false, page_hidden: false });
    await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'tasting', target_id: 'journal-mei' } });
    await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } });
    expect(await read()).toMatchObject({ tasting_hidden: true, page_hidden: true });
    await call(env, OWNER, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'tasting', target_id: 'journal-mei' } });
    await call(env, OWNER, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } });
    expect(await read()).toMatchObject({ tasting_hidden: false, page_hidden: false });
  });
});

describe('GET /api/admin/family/sheet', () => {
  it('downloads only the named day\'s notes and ratings as a CSV, with spreadsheet formulas fenced', async () => {
    const { env } = setup();
    const response = await call(env, OWNER, '/api/admin/family/sheet?day=2026-11-19&from=2026-11-19T00:00:00.000Z&to=2026-11-20T00:00:00.000Z');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="teajia-notes-2026-11-19.csv"');
    // The file opens with a byte order mark so a spreadsheet reads it as UTF-8 (text() strips it).
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await response.text();
    expect(text.startsWith('Written,Tea,Person,Note,Impression,Rating out of ten\r\n')).toBe(true);
    expect(text).toContain('Tea tea-a,Mei Lin,Orchid and wet stone,Love,9');
    // Another day's sitting and another shop's note are not on today's sheet.
    expect(text).not.toContain('Sweet on the second steep');
    expect(text).not.toContain('Smoky the week before');
    expect(text).not.toContain('other shop');
    // A formula is fenced, then quoted as CSV needs for the comma, quote and line break.
    expect(text).toContain(`"'=HYPERLINK(""x""), thin,\nflat"`);
    expect(text).toContain(',Dislike,4');
  });

  it('answers a day with nothing in it with just the header, and refuses a bad day', async () => {
    const { env } = setup();
    const empty = await (await call(env, OWNER, '/api/admin/family/sheet?day=2026-01-01')).text();
    expect(empty).toBe('Written,Tea,Person,Note,Impression,Rating out of ten\r\n');
    expect((await call(env, OWNER, '/api/admin/family/sheet?day=yesterday')).status).toBe(400);
    expect((await call(env, OWNER, '/api/admin/family/sheet?from=2026-11-20T00:00:00Z&to=2026-11-19T00:00:00Z')).status).toBe(400);
  });
});

describe('reports the shop can read', () => {
  it('says what was reported, shows the photograph, and whether it is already hidden', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_width, full_height, small_width, small_height, full_bytes, small_bytes, share_state)
      VALUES ('photo-1', ?, 'tea-a', 'member-one', 'family-photos/k-full.jpg', 'family-photos/k-small.jpg', 2000, 1500, 480, 360, 900000, 100000, 'page')`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state)
      VALUES ('journal-mei', ?, 'tea-a', 'member-one', 'page')`).run(SHOP);
    for (const [kind, id] of [['page', 'mei-page'], ['photograph', 'photo-1'], ['tasting', 'journal-mei']]) {
      const sent = await call(env, null, '/api/family/reports', { method: 'POST', body: { target_kind: kind, target_id: id, reason: 'not right' } });
      expect(sent.status).toBe(201);
    }
    const reports = ((await (await call(env, OWNER, '/api/admin/family/reports')).json()) as any).reports;
    const byKind = Object.fromEntries(reports.map((r: any) => [r.target_kind, r]));
    expect(byKind.page).toMatchObject({ label: "Mei Lin's page", hidden: false });
    expect(byKind.photograph).toMatchObject({
      label: 'Photograph of Tea tea-a by Mei', small_url: expect.stringMatching(/^https:\/\/media\.teajia\.co\/family-photos\/k-small\.jpg\?exp=\d+&sig=[0-9a-f]{64}$/), hidden: false,
    });
    expect(byKind.tasting).toMatchObject({ label: 'Tasting of Tea tea-a by Mei', hidden: false });
    // Hiding acts on the report and the list says the thing is hidden.
    await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'photograph', target_id: 'photo-1' } });
    const acted = ((await (await call(env, OWNER, '/api/admin/family/reports?status=acted')).json()) as any).reports;
    expect(acted).toHaveLength(1);
    expect(acted[0]).toMatchObject({ target_kind: 'photograph', hidden: true });
  });
});

describe('the sheet\'s pure parts', () => {
  it('fences formulas and escapes CSV', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@sum')).toBe("'@sum");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(7)).toBe('7');
    expect(csvCell(null)).toBe('');
  });

  it('turns a day into a range of instants, or refuses it', () => {
    expect(sheetRange(new URLSearchParams('day=2026-11-19'))).toEqual({ day: '2026-11-19', from: '2026-11-19T00:00:00.000Z', to: '2026-11-20T00:00:00.000Z' });
    expect(sheetRange(new URLSearchParams('day=2026-02-30x'))).toBeNull();
    expect(sheetRange(new URLSearchParams('from=2026-11-19T05:00:00Z&to=2026-11-20T05:00:00Z'))?.day).toBe('2026-11-19');
    expect(sheetRange(new URLSearchParams(''), new Date('2026-03-04T12:00:00Z'))?.day).toBe('2026-03-04');
    expect(sheetCsv([]).endsWith('\r\n')).toBe(true);
  });
});

describe('a second sitting does not read the first one twice', () => {
  const row = {
    id: 'j', product_id: 'p', author_name: 'Mei', created_at: '2026-11-19 09:00:00', rating: 9,
    note: JSON.stringify({
      verdict: 'love', updatedAt: '2026-11-19T09:00:00Z',
      // The tasting screen saves every note of the tasting joined as the personal note.
      personalNote: 'Smoky the week before\nOrchid and wet stone',
      tasting: { notes: [
        { id: 'n1', text: 'Smoky the week before', capturedAt: '2026-11-12T09:00:00Z' },
        { id: 'n2', text: 'Orchid and wet stone', capturedAt: '2026-11-19T09:00:00Z' },
      ] },
    }),
    tastings: JSON.stringify([
      { id: 's1', createdAt: '2026-11-12T09:00:00Z', tasting: { notes: [{ id: 'n1', text: 'Smoky the week before', capturedAt: '2026-11-12T09:00:00Z' }] } },
      { id: 's2', createdAt: '2026-11-19T09:00:00Z', tasting: { notes: [{ id: 'n2', text: 'Orchid and wet stone', capturedAt: '2026-11-19T09:00:00Z' }] } },
    ]),
  };

  it('lists two notes for two sittings, not three', () => {
    const notes = feedbackFromRow(row, new Map());
    expect(notes.map(n => n.text).sort()).toEqual(['Orchid and wet stone', 'Smoky the week before']);
  });

  it('keeps the joined block when the shop has already decided on it', () => {
    const notes = feedbackFromRow(row, new Map([['j::personal', 'promoted' as const]]));
    expect(notes.filter(n => n.status === 'promoted')).toHaveLength(1);
  });
});
