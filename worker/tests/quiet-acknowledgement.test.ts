import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { request as pilotRequest } from './helpers/personalSellerPilot';

// Quiet acknowledgement (CLAUDE.md, third exception; todo/plans/guests-and-tea-masters.md,
// "Quiet acknowledgement"): only things one person gives another, in words.
// - "photograph by <first name>" on a family photograph, only when its
//   photographer said yes, and starting at no;
// - "poured with" on a published recap: the public co-hosts and guest hosts,
//   linked only when their page is published;
// - "who pours" on the people list: a yes for someone credited on a completed
//   session, never a count, never anything for a session still ahead.
const databases: SqliteD1[] = [];
// Acknowledgement opens with the Tea Table (A4 review, finding 11); these
// checks run with it open, and the last block runs with it closed.
let tableOpen = 'true';
const request: typeof pilotRequest = (db, path, options = {}) =>
  pilotRequest(db, path, { ...options, vars: { TEA_TABLE_OPEN: tableOpen } });
beforeEach(() => {
  tableOpen = 'true';
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
});
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });

const SHOP = 'shop';
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 16);

function base() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP });
  db.exec(`UPDATE accounts SET is_platform_owner = 1 WHERE id = '${SHOP}'`);
  return db;
}

const person = (db: SqliteD1, id: string, name: string, published: boolean, photo = true) => {
  db.sqlite.prepare(`INSERT OR IGNORE INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
    .run(`user-${id}`, `${id}@test.dev`, name);
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, portrait_url) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, SHOP, `user-${id}`, name, published ? 1 : 0, photo ? `${id}.jpg` : null);
  db.sqlite.prepare(`INSERT OR IGNORE INTO contributor_accounts (contributor_id, account_id) VALUES (?, ?)`).run(id, SHOP);
};

describe('photograph by <first name>', () => {
  function setup() {
    const db = base();
    seedIdentity(db, { userId: 'mei', accountId: 'mei-home', publicEnabled: false });
    db.exec(`UPDATE users SET name = 'Mei Lin Tan' WHERE id = 'mei'`);
    seedIdentity(db, { userId: 'jun', accountId: 'jun-home', publicEnabled: false });
    db.exec(`
      INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams)
      VALUES ('tea', '${SHOP}', 'Oolong', 'Oolong', 'Oolong', 1, 1, 'Active', 100);
      INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
        full_width, full_height, small_width, small_height, share_state)
      VALUES ('photo', '${SHOP}', 'tea', 'mei', 'full.jpg', 'small.jpg', 900000, 90000, 2000, 1500, 480, 360, 'page');
    `);
    return db;
  }
  const mei = { userId: 'mei', name: 'Mei Lin Tan', accountId: 'mei-home' };
  const jun = { userId: 'jun', name: 'jun', accountId: 'jun-home' };
  const shown = async (db: SqliteD1) => {
    const body = await (await request(db, '/api/family/teas/tea/photographs')).json() as { family: Array<Record<string, unknown>> };
    return body.family[0];
  };

  it('starts at no: a photograph already taken carries no name', async () => {
    const db = setup();
    expect(db.sqlite.prepare(`SELECT credit_name_shown FROM member_photographs WHERE id = 'photo'`).get()).toEqual({ credit_name_shown: 0 });
    expect((await shown(db)).photograph_by).toBeNull();
  });

  it('the photographer can say yes, and then only the first name travels', async () => {
    const db = setup();
    const yes = await request(db, '/api/family/photographs/photo/credit', { actor: mei, method: 'PUT', body: { credit_name_shown: true } });
    expect(yes.status).toBe(200);
    expect(((await yes.json()) as { photograph: { credit_name_shown: boolean } }).photograph.credit_name_shown).toBe(true);
    expect((await shown(db)).photograph_by).toBe('Mei');

    const no = await request(db, '/api/family/photographs/photo/credit', { actor: mei, method: 'PUT', body: { credit_name_shown: false } });
    expect(no.status).toBe(200);
    expect((await shown(db)).photograph_by).toBeNull();
  });

  it('when not allowed, neither the full nor the first name nor the page leaves the worker', async () => {
    const db = setup();
    // A published page whose name and address both carry the photographer's name.
    db.exec(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('mei-lin-tan', '${SHOP}', 'mei', 'Mei Lin Tan', 1)`);
    db.exec(`UPDATE member_photographs SET shop_use = 'placed' WHERE id = 'photo'`);
    db.exec(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
        full_width, full_height, small_width, small_height, share_state, shop_use)
      VALUES ('lead', '${SHOP}', 'tea', 'mei', 'lead-full.jpg', 'lead-small.jpg', 900000, 90000, 2000, 1500, 480, 360, 'offered', 'lead'),
             ('fam', '${SHOP}', 'tea', 'mei', 'fam-full.jpg', 'fam-small.jpg', 900000, 90000, 2000, 1500, 480, 360, 'page', 'none')`);
    const text = await (await request(db, '/api/family/teas/tea/photographs')).text();
    const body = JSON.parse(text) as { lead: Record<string, unknown>; placed: Array<Record<string, unknown>>; family: Array<Record<string, unknown>> };
    expect([body.lead, ...body.placed, ...body.family]).toHaveLength(3);
    for (const photo of [body.lead, ...body.placed, ...body.family]) {
      expect(photo.author).toBeNull();
      expect(photo.photograph_by).toBeNull();
    }
    expect(text).not.toMatch(/mei/i);
    expect(text).not.toContain('Tan');

    // Allowed: the first name, and the published page, and still never the full name.
    await request(db, '/api/family/photographs/fam/credit', { actor: mei, method: 'PUT', body: { credit_name_shown: true } });
    const after = JSON.parse(await (await request(db, '/api/family/teas/tea/photographs')).text()) as typeof body;
    expect(after.family[0].author).toEqual({ name: 'Mei', page_id: 'mei-lin-tan' });
    expect(JSON.stringify(after)).not.toContain('Mei Lin Tan');
    expect(after.lead.author).toBeNull();
  });

  it('the shop still sees who offered a photograph', async () => {
    const db = setup();
    db.exec(`UPDATE member_photographs SET share_state = 'offered', offered_at = datetime('now') WHERE id = 'photo'`);
    const shop = await request(db, '/api/admin/family/photographs', { actor: { userId: 'owner', name: 'owner', accountId: SHOP } });
    expect(shop.status).toBe(200);
    const pile = await shop.json() as { photographs?: Array<{ author: { name: string } }> } | Array<{ author: { name: string } }>;
    const rows = Array.isArray(pile) ? pile : pile.photographs ?? [];
    expect(rows[0].author.name).toBe('Mei Lin Tan');
  });

  it('nobody else can say it for them, and the answer must be a yes or a no', async () => {
    const db = setup();
    expect((await request(db, '/api/family/photographs/photo/credit', { actor: jun, method: 'PUT', body: { credit_name_shown: true } })).status).toBe(404);
    expect((await request(db, '/api/family/photographs/photo/credit', { method: 'PUT', body: { credit_name_shown: true } })).status).toBe(401);
    expect((await request(db, '/api/family/photographs/photo/credit', { actor: mei, method: 'PUT', body: { credit_name_shown: 'yes' } })).status).toBe(400);
    expect((await shown(db)).photograph_by).toBeNull();
  });
});

describe('poured with', () => {
  function setup() {
    const db = base();
    person(db, 'host', 'Adrian Host', true);
    person(db, 'cohost', 'Mei Lin', true);
    person(db, 'guest', 'Jun Wei Chen', false);
    person(db, 'quiet', 'Quiet Person', true);
    db.exec(`
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
      VALUES ('sit', '${SHOP}', 'courtyard', 'Tea in the courtyard', '2026-11-20', 'completed', 'public', 'published');
      INSERT INTO event_post_session (event_id, account_id, session_notes) VALUES ('sit', '${SHOP}', 'Notes');
      INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public, display_order) VALUES
        ('c1', 'sit', '${SHOP}', 'host', 'lead_host', 1, 0),
        ('c2', 'sit', '${SHOP}', 'cohost', 'co_host', 1, 1),
        ('c3', 'sit', '${SHOP}', 'guest', 'guest_host', 1, 2),
        ('c4', 'sit', '${SHOP}', 'quiet', 'co_host', 0, 3);
    `);
    return db;
  }

  it('names the public co-hosts and guest hosts, linking only a published page', async () => {
    const db = setup();
    const { recap } = await (await request(db, '/api/public/sit-recaps/courtyard')).json() as { recap: Record<string, any> };
    expect(recap.poured_with).toEqual([
      { name: 'Mei Lin', slug: 'cohost' },
      { name: 'Jun', slug: null },
    ]);
    // The people line is unchanged: published credits only.
    expect(recap.people.map((p: { slug: string }) => p.slug)).toEqual(['host', 'cohost']);
  });

  it('never names the lead host, nor a credit the host kept private', async () => {
    const db = setup();
    const text = await (await request(db, '/api/public/sit-recaps/courtyard')).text();
    const pouredWith = JSON.parse(text).recap.poured_with as Array<{ name: string }>;
    expect(pouredWith.map(p => p.name)).not.toContain('Adrian Host');
    expect(text).not.toContain('Quiet Person');
    expect(text).not.toContain('Jun Wei Chen');
  });
});

describe('who pours', () => {
  function setup() {
    const db = base();
    person(db, 'poured', 'Poured Person', true);
    person(db, 'guestpour', 'Guest Pour', true);
    person(db, 'soon', 'Soon Host', true);
    person(db, 'hidden', 'Hidden Credit', true);
    person(db, 'never', 'Never Hosted', true);
    db.exec(`
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility) VALUES
        ('done', '${SHOP}', 'done', 'Done', '${days(-10)}', 'completed', 'public'),
        ('done2', '${SHOP}', 'done2', 'Done again', '${days(-5)}', 'archived', 'public'),
        ('ahead', '${SHOP}', 'ahead', 'Ahead', '${days(10)}', 'published', 'public'),
        ('cancelled', '${SHOP}', 'cancelled', 'Cancelled', '${days(-3)}', 'cancelled', 'public');
      INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public) VALUES
        ('p1', 'done', '${SHOP}', 'poured', 'lead_host', 1),
        ('p2', 'done2', '${SHOP}', 'poured', 'co_host', 1),
        ('p3', 'done', '${SHOP}', 'guestpour', 'guest_host', 1),
        ('p4', 'ahead', '${SHOP}', 'soon', 'lead_host', 1),
        ('p5', 'cancelled', '${SHOP}', 'soon', 'co_host', 1),
        ('p6', 'done', '${SHOP}', 'hidden', 'co_host', 0),
        ('p7', 'done', '${SHOP}', 'never', 'photographer', 1);
    `);
    return db;
  }

  it('is a plain yes only for someone credited on a completed session', async () => {
    const db = setup();
    const { contributors } = await (await request(db, '/api/people')).json() as { contributors: Array<Record<string, unknown>> };
    const pours = Object.fromEntries(contributors.map(c => [c.id, c.pours]));
    expect(pours).toEqual({ poured: true, guestpour: true, soon: false, hidden: false, never: false });
    // Someone about to host is still a host in the old sense; pouring waits for the session.
    expect(contributors.find(c => c.id === 'soon')?.is_host).toBe(true);
  });

  it('is never a number, and the figure behind it never leaves the worker', async () => {
    const db = setup();
    const { contributors } = await (await request(db, '/api/people')).json() as { contributors: Array<Record<string, unknown>> };
    for (const c of contributors) {
      expect(typeof c.pours).toBe('boolean');
      expect(c).not.toHaveProperty('list_pours');
    }
  });

  it('does not change the order of the list', async () => {
    const db = setup();
    const { contributors } = await (await request(db, '/api/people')).json() as { contributors: Array<{ id: string }> };
    // Not family pages, so the season group, by name: pouring earns no place.
    expect(contributors.map(c => c.id)).toEqual(['guestpour', 'hidden', 'never', 'poured', 'soon']);
  });
});

describe('while the Tea Table is closed', () => {
  beforeEach(() => { tableOpen = 'false'; });

  it('no public answer carries photograph_by, poured_with or pours, and the credit cannot be changed', async () => {
    const db = base();
    seedIdentity(db, { userId: 'mei', accountId: 'mei-home', publicEnabled: false });
    person(db, 'host', 'Adrian Host', true);
    person(db, 'cohost', 'Mei Lin', true);
    db.exec(`
      INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams)
      VALUES ('tea', '${SHOP}', 'Oolong', 'Oolong', 'Oolong', 1, 1, 'Active', 100);
      INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
        full_width, full_height, small_width, small_height, share_state, credit_name_shown)
      VALUES ('photo', '${SHOP}', 'tea', 'mei', 'full.jpg', 'small.jpg', 900000, 90000, 2000, 1500, 480, 360, 'page', 1);
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status)
      VALUES ('sit', '${SHOP}', 'courtyard', 'Tea in the courtyard', '2026-11-20', 'completed', 'public', 'published');
      INSERT INTO event_post_session (event_id, account_id, session_notes) VALUES ('sit', '${SHOP}', 'Notes');
      INSERT INTO event_contributors (id, event_id, account_id, contributor_id, role, is_public, display_order) VALUES
        ('c1', 'sit', '${SHOP}', 'host', 'lead_host', 1, 0),
        ('c2', 'sit', '${SHOP}', 'cohost', 'co_host', 1, 1);
    `);
    const photos = await (await request(db, '/api/family/teas/tea/photographs')).json() as { family: Array<Record<string, unknown>> };
    expect(photos.family[0]).not.toHaveProperty('photograph_by');
    const { recap } = await (await request(db, '/api/public/sit-recaps/courtyard')).json() as { recap: Record<string, unknown> };
    expect(recap).not.toHaveProperty('poured_with');
    const { contributors } = await (await request(db, '/api/people')).json() as { contributors: Array<Record<string, unknown>> };
    expect(contributors.length).toBeGreaterThan(0);
    for (const c of contributors) expect(c).not.toHaveProperty('pours');

    const absent = await request(db, '/api/family/photographs/photo/no-such-route', { actor: { userId: 'mei', name: 'Mei', accountId: 'mei-home' }, method: 'PUT', body: {} });
    const closed = await request(db, '/api/family/photographs/photo/credit', { actor: { userId: 'mei', name: 'Mei', accountId: 'mei-home' }, method: 'PUT', body: { credit_name_shown: false } });
    expect(closed.status).toBe(404);
    expect(await closed.text()).toBe(await absent.text());
    expect(db.sqlite.prepare(`SELECT credit_name_shown FROM member_photographs WHERE id = 'photo'`).get()).toEqual({ credit_name_shown: 1 });
  });
});
