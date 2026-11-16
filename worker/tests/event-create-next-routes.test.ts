import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const SECRET = 'event-create-next-test-secret';
const databases: SqliteD1[] = [];
const copied = {
  title: 'Cliff tea', subtitle: 'A quiet table', description: 'Source description',
  flyer_image_url: '/source.jpg', location_name: 'Old room', address_text: 'Source address',
  map_link: 'https://map.test/room', guidelines_text: 'Bring a cup', venue_guide: 'Upstairs',
  total_capacity: 8, claim_window_minutes: 45, timezone: 'Asia/Taipei',
  session_flow: '["welcome","tea"]', playlist_url: 'https://music.test/list',
  event_format: 'tea_circle', location_id: null, venue_id: null, active_space_ids: '["room"]',
  gathering_type: 'private', area_hint: 'North', mood_hints: '["quiet"]',
  briefing_cards: '["arrive early"]', requires_approval: 0,
};

function seed(schema: 'schema' | 'migrations') {
  const db = new SqliteD1(schema);
  databases.push(db);
  seedIdentity(db, { userId: 'host', accountId: 'account-a', bundles: ['gather'] });
  seedIdentity(db, { userId: 'other', accountId: 'account-b', bundles: ['gather'] });
  seedIdentity(db, { userId: 'viewer', accountId: 'account-a', role: 'viewer', bundles: [] });
  const source = { id: 'source', account_id: 'account-a', slug: 'source', ...copied,
    event_date: '2099-01-01', event_end_date: '2099-01-02', status: 'active',
    lifecycle_status: 'published', public_visibility: 'private', network_discovery: 0, recap_status: 'published' };
  db.sqlite.prepare(`INSERT INTO events (${Object.keys(source).join(',')}) VALUES (${Object.keys(source).map(() => '?').join(',')})`)
    .run(...Object.values(source));
  return db;
}

function menu(db: SqliteD1) {
  db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type, cost_amount, cost_currency, cost_currency_source, shipping_rate_per_kg, markup_multiplier)
    VALUES ('product', 'account-a', 'Fixture tea', 'oolong', NULL, NULL, NULL, NULL, NULL)`).run();
  const insert = db.sqlite.prepare(`INSERT INTO event_tea_menu
    (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order, created_at)
    VALUES (?, ?, 'source', ?, ?, ?, ?, ?, '2000-01-01')`);
  insert.run('menu-product', 'account-a', 'product', 'Product name', 'Product notes', '2099-01-01', 0);
  insert.run('menu-custom', 'account-a', null, 'Custom tea', null, null, 2);
  // Historical malformed account linkage must not be carried into the new event.
  insert.run('menu-other-account', 'account-b', null, 'Private other account', null, null, 3);
}

async function invoke(db: SqliteD1, options: { user?: string | null; account?: string; source?: string; body?: object } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'X-Teajia-Account': options.account ?? 'account-a' });
  if (options.user !== null) headers.set('Authorization', `Bearer ${await signedToken(SECRET, { sub: options.user ?? 'host', email: `${options.user ?? 'host'}@test.dev` })}`);
  return worker.fetch(new Request(`https://worker.test/api/admin/events/${options.source ?? 'source'}/create-next`, {
    method: 'POST', headers, body: JSON.stringify(options.body ?? { next_date: '2099-02-01', slug: 'next' }),
  }), { DB: db, JWT_SECRET: SECRET } as any);
}

function count(db: SqliteD1, table: string) {
  return (db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) db.close();
});

for (const schema of ['schema', 'migrations'] as const) describe(`create-next registered route (${schema})`, () => {
  it('clones an empty event as a fresh draft with the existing field and reset contract', async () => {
    const db = seed(schema);
    const response = await invoke(db);
    expect(response.status).toBe(201);
    const result = await response.json() as { id: string; slug: string };
    expect(result.slug).toBe('next');
    expect(result.id).not.toBe('source');
    const event = db.sqlite.prepare('SELECT * FROM events WHERE id = ?').get(result.id);
    expect(event).toMatchObject({ ...copied, id: result.id, account_id: 'account-a', slug: 'next',
      event_date: '2099-02-01', event_end_date: null, status: 'draft', lifecycle_status: 'draft', recap_status: 'draft' });
    expect(count(db, 'events')).toBe(2);
    expect(count(db, 'event_tea_menu')).toBe(0);
    const publicMenu = await worker.fetch(new Request('https://worker.test/api/events/next/tea-menu'), { DB: db } as any);
    expect(publicMenu.status).toBe(404);
  });

  it('copies supported menu fields and product references, resets reveals and keeps account isolation', async () => {
    const db = seed(schema);
    menu(db);
    const before = db.sqlite.prepare('SELECT * FROM event_tea_menu ORDER BY id').all();
    const response = await invoke(db);
    expect(response.status).toBe(201);
    const result = await response.json() as { id: string };
    const rows = db.sqlite.prepare('SELECT * FROM event_tea_menu WHERE event_id = ? ORDER BY brew_order').all(result.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ account_id: 'account-a', event_id: result.id, product_id: 'product',
      custom_name: 'Product name', custom_description: 'Product notes', reveal_date: null, brew_order: 0 });
    expect(rows[1]).toMatchObject({ account_id: 'account-a', event_id: result.id, product_id: null,
      custom_name: 'Custom tea', custom_description: null, reveal_date: null, brew_order: 2 });
    expect(rows.every(row => !before.some(source => row.id === source.id) && row.created_at !== '2000-01-01')).toBe(true);
    expect(db.sqlite.prepare('SELECT * FROM event_tea_menu WHERE event_id = ? ORDER BY id').all('source')).toEqual(before);
    const publicMenu = await worker.fetch(new Request('https://worker.test/api/events/next/tea-menu'), { DB: db } as any);
    expect(publicMenu.status).toBe(404);
  });

  it('rolls back the event and every menu row when a later copy fails, then allows a clean retry', async () => {
    const db = seed(schema);
    menu(db);
    db.sqlite.exec(`CREATE TRIGGER reject_clone_menu BEFORE INSERT ON event_tea_menu
      WHEN NEW.event_id != 'source' AND NEW.custom_name = 'Custom tea'
      BEGIN SELECT RAISE(ABORT, 'synthetic copy failure'); END`);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await invoke(db);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'Internal server error' });
    expect(count(db, 'events')).toBe(1);
    expect(count(db, 'event_tea_menu')).toBe(3);
    expect(errors).toHaveBeenCalled();
    db.sqlite.exec('DROP TRIGGER reject_clone_menu');
    expect((await invoke(db)).status).toBe(201);
    expect(count(db, 'events')).toBe(2);
    expect(count(db, 'event_tea_menu')).toBe(5);
    expect((await invoke(db)).status).toBe(409);
    expect(count(db, 'events')).toBe(2);
  });

  it('requires authentication, gather permission and source ownership before changing data', async () => {
    const db = seed(schema);
    expect((await invoke(db, { user: null })).status).toBe(401);
    expect((await invoke(db, { user: 'viewer' })).status).toBe(403);
    expect((await invoke(db, { user: 'other', account: 'account-b' })).status).toBe(404);
    expect((await invoke(db, { user: 'host', account: 'account-b' })).status).toBe(403);
    expect((await invoke(db, { source: 'missing' })).status).toBe(404);
    expect(count(db, 'events')).toBe(1);
  });

  it('keeps required input and global slug conflict checks', async () => {
    const db = seed(schema);
    expect((await invoke(db, { body: { slug: 'next' } })).status).toBe(400);
    expect((await invoke(db, { body: { next_date: '2099-02-01' } })).status).toBe(400);
    expect((await invoke(db, { body: { next_date: '2099-02-01', slug: 'source' } })).status).toBe(409);
    expect(count(db, 'events')).toBe(1);
  });
});
