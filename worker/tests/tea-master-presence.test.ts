import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The tea master's presence beyond their own page (2026-09-21): the two
// reverse doors that did not exist (the people at a store's table, the hosts
// of an event), the self-serve collection that the profile's tea section
// points at, and the two words the public page reads that only an admin
// could write (who taught me, the last line). Every read is driven against
// a real database, and every door is checked for what it must NOT leak: an
// unpublished person, a hidden host, a bank detail.

const SECRET = 'tea-master-presence-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

async function anonymous(db: SqliteD1, path: string) {
  return worker.fetch(new Request(`https://worker.test${path}`), env(db));
}

async function as(db: SqliteD1, userId: string, path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: 'acc-one', platform_role: null });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'acc-one' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? (options.body !== undefined ? 'PUT' : 'GET'), headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env(db));
}

function seedPerson(db: SqliteD1, options: { id: string; userId?: string; published?: boolean; nowText?: string | null; portrait?: string | null }) {
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, now_text, portrait_url, links)
    VALUES (?, 'acc-one', ?, ?, ?, ?, ?, '[]')`).run(
      options.id, `Display ${options.id}`, options.userId ?? null, options.published === false ? 0 : 1,
      options.nowText ?? `I pour as ${options.id}. Second sentence.`, options.portrait ?? null,
    );
}

function seedTea(db: SqliteD1, profileId: string, productId: string) {
  db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, 'acc-one', ?, 'Oolong', 'Active', 1, 1, 100)`).run(productId, productId);
  db.sqlite.prepare(`INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, status, network_visible)
    VALUES (?, ?, 'acc-one', 'acc-one', ?, 'published', 1)`).run(profileId, profileId, profileId);
  db.sqlite.prepare(`INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, status, is_public, shown_in_shop, stock_grams)
    VALUES (?, 'acc-one', ?, ?, 'active', 1, 1, 100)`).run(`listing-${productId}`, profileId, productId);
}

describe('the people at a store (GET /api/s/:slug)', () => {
  it('lists the published people linked to the store, the host first, each in their own first line, and leaves out the unpublished', async () => {
    const db = database(); seedIdentity(db);
    seedPerson(db, { id: 'kenji', nowText: 'I pour on Saturday evenings.\n\nFour guests at most.', portrait: 'https://example.com/kenji.jpg' });
    seedPerson(db, { id: 'mika', nowText: 'I weigh, I steep.' });
    seedPerson(db, { id: 'quiet', published: false });
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role, is_host, display_order) VALUES ('mika', 'acc-one', 'Tea master', 0, 0)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role, is_host, display_order) VALUES ('kenji', 'acc-one', 'Tea master · host', 1, 1)`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role, is_host, display_order) VALUES ('quiet', 'acc-one', 'Tea master', 0, 2)`).run();

    const response = await anonymous(db, '/api/s/acc-one');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.people.map((person: any) => person.slug)).toEqual(['kenji', 'mika']);
    expect(body.people[0]).toEqual({
      slug: 'kenji', display_name: 'Display kenji', business_name: null, role: 'Tea master · host',
      portrait_url: 'https://example.com/kenji.jpg', own_line: 'I pour on Saturday evenings.', is_host: true,
    });
    expect(body.people[1].is_host).toBe(false);
    // Nothing private rides along: no user id, no email, no account id.
    for (const person of body.people) {
      expect(Object.keys(person).sort()).toEqual(['business_name', 'display_name', 'is_host', 'own_line', 'portrait_url', 'role', 'slug']);
    }
  });

  it('is an empty list, not an absent key, on a table nobody published is linked to', async () => {
    const db = database(); seedIdentity(db);
    const body = await (await anonymous(db, '/api/s/acc-one')).json() as any;
    expect(body.people).toEqual([]);
  });
});

describe('the hosts of an event (GET /api/events/:slug/public)', () => {
  function seedEvent(db: SqliteD1) {
    db.sqlite.prepare(`INSERT INTO events (id, slug, title, event_date, status, lifecycle_status, public_visibility, account_id, total_capacity)
      VALUES ('evt-1', 'gongfu-evening', 'Gongfu evening', datetime('now', '+10 days'), 'active', 'published', 'public', 'acc-one', 4)`).run();
  }
  function host(db: SqliteD1, id: string, role: string, isPublic = 1, order = 0) {
    db.sqlite.prepare(`INSERT OR IGNORE INTO contributor_accounts (contributor_id, account_id, is_host) VALUES (?, 'acc-one', 0)`).run(id);
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public, display_order)
      VALUES (?, 'acc-one', 'evt-1', ?, ?, ?, ?)`).run(`ec-${id}-${role}`, id, role, isPublic, order);
  }

  it('returns the public hosts lead first, with the role and their own line, and hides a host marked private or unpublished', async () => {
    const db = database(); seedIdentity(db); seedEvent(db);
    seedPerson(db, { id: 'kenji', nowText: 'I pour on Saturday evenings.' });
    seedPerson(db, { id: 'amara', nowText: 'I weigh, I steep.' });
    seedPerson(db, { id: 'ren' });
    seedPerson(db, { id: 'quiet', published: false });
    host(db, 'amara', 'co_host', 1, 0);
    host(db, 'kenji', 'lead_host', 1, 1);
    host(db, 'ren', 'photographer', 0, 2);
    host(db, 'quiet', 'guest_host', 1, 3);

    const body = await (await anonymous(db, '/api/events/gongfu-evening/public')).json() as any;
    expect(body.hosts.map((h: any) => [h.slug, h.role])).toEqual([['kenji', 'lead_host'], ['amara', 'co_host']]);
    expect(body.hosts[0].own_line).toBe('I pour on Saturday evenings.');
    expect(JSON.stringify(body)).not.toContain('quiet');
  });

  it('is an empty list on an event with no public host', async () => {
    const db = database(); seedIdentity(db); seedEvent(db);
    const body = await (await anonymous(db, '/api/events/gongfu-evening/public')).json() as any;
    expect(body.hosts).toEqual([]);
  });
});

describe('naming the selection (PUT /api/me/public-profile/collection)', () => {
  function seedOwner(db: SqliteD1) {
    seedIdentity(db, { userId: 'kenji-user' });
    seedPerson(db, { id: 'kenji', userId: 'kenji-user', portrait: 'https://example.com/kenji.jpg' });
    seedTea(db, 'prof-a', 'prod-a');
    seedTea(db, 'prof-b', 'prod-b');
    seedTea(db, 'prof-c', 'prod-c');
    // Two public favorites and one private; the private one must not become a collection item.
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public) VALUES ('kenji', 'prof-b', 'Rainy afternoons.', 0, 1)`).run();
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public) VALUES ('kenji', 'prof-a', 'The first guest.', 1, 1)`).run();
    db.sqlite.prepare(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public) VALUES ('kenji', 'prof-c', 'Not yet.', 2, 0)`).run();
  }

  it('makes a collection from the public favorites in order, publishes it to the person, and the profile then points at it', async () => {
    const db = database(); seedOwner(db);
    const saved = await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: '  Saturday at the house  ' } });
    expect(saved.status).toBe(200);
    const body = await saved.json() as any;
    expect(body.collection).toEqual({ slug: 'kenji', title: 'Saturday at the house', item_count: 2 });

    const items = db.sqlite.prepare(`SELECT ci.product_id, ci.position, ci.item_note FROM collection_items ci
      JOIN collection_publications cp ON cp.collection_id = ci.collection_id WHERE cp.slug = 'kenji' ORDER BY ci.position`).all() as any[];
    expect(items).toEqual([
      { product_id: 'prod-b', position: 0, item_note: 'Rainy afternoons.' },
      { product_id: 'prod-a', position: 1, item_note: 'The first guest.' },
    ]);
    const collection = db.sqlite.prepare(`SELECT c.hero_image_url, c.status, c.account_id, c.curator_display_name FROM collections c
      JOIN collection_publications cp ON cp.collection_id = c.id WHERE cp.slug = 'kenji'`).get() as any;
    expect(collection).toEqual({ hero_image_url: 'https://example.com/kenji.jpg', status: 'active', account_id: 'acc-one', curator_display_name: 'Display kenji' });

    // The public page points at it, the self read names it, and /c/:slug opens.
    const profile = await (await anonymous(db, '/api/people/kenji')).json() as any;
    expect(profile.collection).toMatchObject({ slug: 'kenji', title: 'Saturday at the house', item_count: 2 });
    const self = await (await as(db, 'kenji-user', '/api/me/public-profile')).json() as any;
    expect(self.contributor.collection).toEqual({ slug: 'kenji', title: 'Saturday at the house', item_count: 2 });
    expect((await anonymous(db, '/api/public/c/kenji')).status).toBe(200);
  });

  it('follows the favorites afterwards: a new favorite joins, a removed one leaves, the order moves', async () => {
    const db = database(); seedOwner(db);
    await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: 'Saturday' } });
    const products = () => (db.sqlite.prepare(`SELECT ci.product_id FROM collection_items ci
      JOIN collection_publications cp ON cp.collection_id = ci.collection_id WHERE cp.slug = 'kenji' ORDER BY ci.position`).all() as any[]).map(r => r.product_id);

    const made = await as(db, 'kenji-user', '/api/me/profile/favorites/prof-c', { body: { is_public: true } });
    expect(made.status).toBe(200);
    expect(products()).toEqual(['prod-b', 'prod-a', 'prod-c']);

    const reordered = await as(db, 'kenji-user', '/api/me/profile/favorites/order', { body: { tea_profile_ids: ['prof-c', 'prof-a', 'prof-b'] } });
    expect(reordered.status).toBe(200);
    expect(products()).toEqual(['prod-c', 'prod-a', 'prod-b']);

    const removed = await as(db, 'kenji-user', '/api/me/profile/favorites/prof-a', { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(products()).toEqual(['prod-c', 'prod-b']);
  });

  it('renames the same collection under the same slug, and an empty title takes the page down without losing it', async () => {
    const db = database(); seedOwner(db);
    await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: 'First name' } });
    const renamed = await (await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: 'Second name' } })).json() as any;
    expect(renamed.collection).toMatchObject({ slug: 'kenji', title: 'Second name' });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM collections WHERE created_by_user_id = 'kenji-user'`).get()).toEqual({ n: 1 });

    const down = await (await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: '' } })).json() as any;
    expect(down.collection).toBeNull();
    expect((await anonymous(db, '/api/public/c/kenji')).status).toBe(410);
    const profile = await (await anonymous(db, '/api/people/kenji')).json() as any;
    expect(profile.collection).toBeNull();
    expect(profile.tea_selection.length).toBe(2);

    const back = await (await as(db, 'kenji-user', '/api/me/public-profile/collection', { body: { title: 'Third name' } })).json() as any;
    expect(back.collection).toMatchObject({ slug: 'kenji', title: 'Third name' });
    expect((await anonymous(db, '/api/public/c/kenji')).status).toBe(200);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM collections WHERE created_by_user_id = 'kenji-user'`).get()).toEqual({ n: 1 });
  });

  it('refuses a caller with no profile, and a title that is not text', async () => {
    const db = database(); seedIdentity(db, { userId: 'nobody' });
    expect((await as(db, 'nobody', '/api/me/public-profile/collection', { body: { title: 'x' } })).status).toBe(409);
    const db2 = database(); seedOwner(db2);
    expect((await as(db2, 'kenji-user', '/api/me/public-profile/collection', { body: { title: 7 } })).status).toBe(400);
  });
});

describe('the two words the page reads (PUT /api/me/public-profile)', () => {
  it('a tea master writes who taught me and the last line from their own page, and the public page reads them', async () => {
    const db = database(); seedIdentity(db, { userId: 'kenji-user' });
    seedPerson(db, { id: 'kenji', userId: 'kenji-user' });
    const saved = await as(db, 'kenji-user', '/api/me/public-profile', { body: { inspirations: 'A visiting master.', closing: 'Stay for the second steep.' } });
    expect(saved.status).toBe(200);
    const self = await (await as(db, 'kenji-user', '/api/me/public-profile')).json() as any;
    expect(self.contributor.inspirations).toBe('A visiting master.');
    expect(self.contributor.closing).toBe('Stay for the second steep.');
    const tooLong = await as(db, 'kenji-user', '/api/me/public-profile', { body: { closing: 'x'.repeat(201) } });
    expect(tooLong.status).toBe(400);
  });
});
