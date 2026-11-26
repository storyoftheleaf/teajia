// Launch 1 contract (slice S1): what the after-sit recap newly carries, the
// keep-tea door while the flag is off, the reading check, and where an order
// request began. Slices S5, S6 and S9 add their own tests beside this one.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { readableArticleFor } from '../src/eventDomain';
import { readVia, recordOrderSessionSource } from '../src/orderSessionSource';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database; FIRST_TABLE_OPEN?: string };
let db: SqliteD1;

const routes = afterSitRoutes<Env>({
  requireHost: async request => {
    const accountId = request.headers.get('Test-Host');
    return accountId ? { accountId } : { error: new Response(null, { status: 403 }) };
  },
  requireUser: async request => {
    const userId = request.headers.get('Test-User');
    return userId ? { userId } : { error: new Response(null, { status: 401 }) };
  },
  limit: async () => null,
  // A stand-in for the shop's public catalogue: only `public-tea` is public.
  readPublic: () => async (_accountId, productId) => productId === 'public-tea'
    ? { id: 'public-tea', slug: 'old-tree-white', status: 'Active', stock_grams: 0 } : null,
  optionalUser: async request => request.headers.get('Test-User'),
});

async function call(path: string, body: unknown, headers: Record<string, string> = {}, env: Partial<Env> = {},
  params: Record<string, string> = {}, method = 'POST') {
  const route = routes.find(([verb, pattern]) => verb === method && pattern === path);
  if (!route) throw new Error(`no route ${path}`);
  const request = new Request(`https://teajia.test${path}`, { method, headers, body: JSON.stringify(body) });
  return route[2](request, { DB: db as unknown as D1Database, ...env }, params);
}

async function credential() {
  const response = await call('/api/admin/events/:eventId/after-sit/:attendeeId', undefined,
    { 'Test-Host': 'shop-a' }, {}, { eventId: 'event-a', attendeeId: 'attendee' });
  return (await response.json() as { credential: string }).credential;
}

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'guest', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'other-user', accountId: 'shop-b' });
  db.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, playlist_url) VALUES
      ('event-a', 'shop-a', 'one', 'Tea evening', '2026-11-22', 'completed', 'https://music.test/before'),
      ('event-open', 'shop-a', 'open', 'Coming sit', '2026-12-22', 'published', null),
      ('event-b', 'shop-b', 'two', 'Other shop sit', '2026-11-22', 'completed', null);
    INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status, attended) VALUES
      ('attendee', 'shop-a', 'event-a', 'Guest', 'token-a', 'confirmed', 1);
    INSERT INTO products (id, account_id, type, product_name) VALUES
      ('public-tea', 'shop-a', 'White', 'Old tree white'),
      ('private-tea', 'shop-a', 'Red', 'Private red');
    INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
      ('menu-public', 'shop-a', 'event-a', 'public-tea', null, 1),
      ('menu-private', 'shop-a', 'event-a', 'private-tea', null, 2),
      ('menu-name', 'shop-a', 'event-a', null, 'A plain name', 3);
    INSERT INTO event_post_session (event_id, account_id, playlist_url) VALUES ('event-a', 'shop-a', 'https://music.test/after');
    INSERT INTO articles (id, account_id, title, slug, status) VALUES
      ('art-live', 'shop-a', 'On white tea', 'on-white-tea', 'published'),
      ('art-draft', 'shop-a', 'Draft piece', 'draft-piece', 'draft'),
      ('art-other', 'shop-b', 'Elsewhere', 'elsewhere', 'published');
  `);
});

afterEach(() => db.close());

describe('the after-sit recap, Launch 1 additions', () => {
  it('gives a path only to a tea with a public page, and the session playlist', async () => {
    const body = await (await call('/api/after-sit/recap', { credential: await credential() }, {}, { FIRST_TABLE_OPEN: 'false' })).json() as Record<string, any>;
    expect(body.teas).toEqual([
      { id: 'menu-public', name: 'Old tree white', path: '/shop/product/old-tree-white?store=shop-a' },
      { id: 'menu-private', name: 'Private red', path: null },
      { id: 'menu-name', name: 'A plain name', path: null },
    ]);
    expect(body.playlist_url).toBe('https://music.test/after');
    expect(body.reading).toBeNull();
    expect(body).not.toHaveProperty('thanks_ref');
  });

  it('shows a reading only while it is a published article of the same shop', async () => {
    const link = await credential();
    db.exec(`UPDATE events SET reading_article_id = 'art-live' WHERE id = 'event-a'`);
    expect((await (await call('/api/after-sit/recap', { credential: link })).json() as any).reading)
      .toEqual({ slug: 'on-white-tea', title: 'On white tea' });
    db.exec(`UPDATE articles SET status = 'draft' WHERE id = 'art-live'`);
    expect((await (await call('/api/after-sit/recap', { credential: link })).json() as any).reading).toBeNull();
  });

  it('with the flag open, gives one stable thanks_ref and marks kept teas for the signed-in guest only', async () => {
    const link = await credential();
    const open = { FIRST_TABLE_OPEN: 'true' };
    const first = await (await call('/api/after-sit/recap', { credential: link }, {}, open)).json() as any;
    expect(first.thanks_ref).toMatch(/^[a-f0-9]{18}$/);
    expect(first.thanks_ref).not.toBe(link);
    expect(first.teas[0]).not.toHaveProperty('kept');
    db.exec(`INSERT INTO personal_cellar_items (id, owner_user_id, name, grams, source_kind, source_event_id, source_tea_ref)
      VALUES ('kept-1', 'guest', 'Old tree white', 0, 'session', 'event-a', 'menu-public'),
             ('kept-2', 'other-user', 'Private red', 0, 'session', 'event-a', 'menu-private')`);
    const signedIn = await (await call('/api/after-sit/recap', { credential: link }, { 'Test-User': 'guest' }, open)).json() as any;
    expect(signedIn.thanks_ref).toBe(first.thanks_ref);
    expect(signedIn.teas.map((tea: any) => tea.kept)).toEqual([true, false, false]);
  });

  it('keeps the keep-tea door shut while the flag is off', async () => {
    const response = await call('/api/after-sit/keep-tea', { credential: await credential(), teaId: 'menu-public' }, { 'Test-User': 'guest' }, { FIRST_TABLE_OPEN: 'false' });
    expect(response.status).toBe(404);
  });
});

describe('a session reading', () => {
  it('accepts only a published article of the same account', async () => {
    const d1 = db as unknown as D1Database;
    expect(await readableArticleFor(d1, 'shop-a', 'art-live')).toEqual({ id: 'art-live', slug: 'on-white-tea', title: 'On white tea' });
    expect(await readableArticleFor(d1, 'shop-a', 'art-draft')).toBeNull();
    expect(await readableArticleFor(d1, 'shop-a', 'art-other')).toBeNull();
    expect(await readableArticleFor(d1, 'shop-a', 'nope')).toBeNull();
    expect(await readableArticleFor(d1, 'shop-a', '')).toBeNull();
  });
});

describe('where an order request began', () => {
  beforeEach(() => {
    db.exec(`
      UPDATE events SET thanks_ref = 'aaaaaaaaaaaaaaaaaa' WHERE id = 'event-a';
      UPDATE events SET thanks_ref = 'bbbbbbbbbbbbbbbbbb' WHERE id = 'event-open';
      UPDATE events SET thanks_ref = 'cccccccccccccccccc' WHERE id = 'event-b';
      -- A published page: the host is the lead host the public page names (sessionHost.ts, A2 F8).
      INSERT INTO contributors (id, account_id, display_name, user_id, is_published) VALUES ('host-c', 'shop-a', 'Adrian', 'guest', 1);
      INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('host-c', 'shop-a');
      INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role) VALUES ('ec-1', 'shop-a', 'event-a', 'host-c', 'lead_host');
      INSERT INTO inquiries (id, account_id, name, email, items, ref_number) VALUES
        ('inq-1', 'shop-a', 'Buyer', 'buyer@test.dev', '[]', 'R-1'),
        ('inq-2', 'shop-a', 'Buyer', 'buyer@test.dev', '[]', 'R-2');
    `);
  });

  it('writes one row naming the session and its host, once', async () => {
    const d1 = db as unknown as D1Database;
    expect(await recordOrderSessionSource(d1, 'inq-1', 'aaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(await recordOrderSessionSource(d1, 'inq-1', 'aaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(db.sqlite.prepare('SELECT inquiry_id, account_id, event_id, host_user_id FROM order_session_sources').all())
      .toEqual([{ inquiry_id: 'inq-1', account_id: 'shop-a', event_id: 'event-a', host_user_id: 'guest' }]);
  });

  it('writes nothing for an unknown, unfinished, foreign or malformed reference', async () => {
    const d1 = db as unknown as D1Database;
    for (const via of ['dddddddddddddddddd', 'bbbbbbbbbbbbbbbbbb', 'cccccccccccccccccc', 'AAAA', 'a'.repeat(400), null, 7]) {
      expect(await recordOrderSessionSource(d1, 'inq-2', via)).toBe(false);
    }
    expect(await recordOrderSessionSource(d1, 'no-such-inquiry', 'aaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM order_session_sources').get()).toEqual({ n: 0 });
    expect(readVia('aaaaaaaaaaaaaaaaaa')).toBe('aaaaaaaaaaaaaaaaaa');
  });
});
