// Launch 2, slice H6 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Sol, H6" and hard question 7), with Contract B of audit A2.
//
// A host lists teas on their own table: a tea of Teajia's shop first, a tea
// of their own Tea Chest second, a typed name last. The one door across
// accounts is a public, active, shown tea of the platform owner's shop.
// Anything else (a draft, a hidden or archived shop tea, a third account's
// product, an id that does not exist, another person's Tea Chest) resolves to
// a plain name with no path, price or product id, wherever it is read.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { resolveSessionTeas } from '../src/sessionTeas';
import { readSessionServedTeas } from '../src/sessionServedTeas';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-teas-secret';
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'teajia-shop' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };

let db: SqliteD1;
let stored: Map<string, string>;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean; form?: FormData } = {}) {
  const { actor, body, method = 'GET', open = true, form } = options;
  const headers = new Headers(form ? {} : { 'Content-Type': 'application/json' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  const allow = { limit: async () => ({ success: true }) };
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: open ? 'true' : 'false',
    PROVIDER_LIMITER: allow, RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow,
    MEDIA_BUCKET: { put: async (key: string) => { stored.set(key, 'image'); } },
  } as never, { waitUntil: () => undefined } as never);
}

function personalAccount(userId: string) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(id, id, id, userId, userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function product(id: string, accountId: string, name: string, options: { status?: string; isPublic?: 0 | 1; shown?: 0 | 1; type?: string } = {}) {
  db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, given_name, type, year, status, is_public, shown_in_shop,
      stock_grams, cost_amount, cost_currency, slug)
    VALUES (?, ?, ?, ?, ?, 2015, ?, ?, ?, 500, 120, 'Yuan', ?)`)
    .run(id, accountId, name, name, options.type ?? 'Shou', options.status ?? 'Active', options.isPublic ?? 1, options.shown ?? 1, `${id}-slug`);
}

function table(id: string, accountId: string, hostUserId: string) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status)
    VALUES (?, ?, ?, ?, ?, 4, 'Asia/Makassar', 'link', 0, 'unlisted', 0, ?, 'active', 'published')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, new Date(Date.now() + 7 * 86400000).toISOString(), hostUserId);
}

const menuRows = () => db.sqlite.prepare(
  'SELECT product_id, custom_name, custom_description, photo_url, brew_order FROM event_tea_menu WHERE event_id = ? ORDER BY brew_order',
).all('t-ana') as Array<Record<string, unknown>>;

const MONEY = /price|cost|stock|_usd|grams/i;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  stored = new Map();
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather', 'sell'] });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(adrian.accountId);
  seedIdentity(db, { userId: 'cy', accountId: 'cy-shop' });
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-home`, publicEnabled: false });
    personalAccount(person.userId);
  }
  // Teajia's shop.
  product('p-shou', adrian.accountId, '2015 Shou Brick');
  product('p-draft', adrian.accountId, 'Shou in draft', { status: 'Draft' });
  product('p-hidden', adrian.accountId, 'Shou kept back', { shown: 0 });
  product('p-private', adrian.accountId, 'Shou not public', { isPublic: 0 });
  product('p-archived', adrian.accountId, 'Shou of old', { status: 'Archived' });
  product('p-cup', adrian.accountId, 'Shou cup', { type: 'Teaware' });
  // A third shop, and two Tea Chests.
  product('p-cy', 'cy-shop', 'Shou from another shop');
  product('p-ana', ana.accountId, 'Shoulder of the mountain oolong', { type: 'Oolong', isPublic: 0 });
  product('p-bo', bo.accountId, 'Shou of Bo', { isPublic: 0 });
  table('t-ana', ana.accountId, ana.userId);
  table('t-bo', bo.accountId, bo.userId);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('finding a tea', () => {
  it('offers Teajia’s public teas first, then the host’s own chest, and nothing else', async () => {
    const response = await call('/api/me/tables/t-ana/tea-search?q=sho', { actor: ana });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { matches } = await response.json() as { matches: Array<Record<string, unknown>> };
    expect(matches).toEqual([
      { source: 'shop', id: 'p-shou', name: '2015 Shou Brick', type: 'Shou', year: '2015' },
      { source: 'chest', id: 'p-ana', name: 'Shoulder of the mountain oolong', type: 'Oolong', year: '2015' },
    ]);
    expect(JSON.stringify(matches)).not.toMatch(MONEY);
  });

  it('asks nothing for one letter, escapes wildcards, and answers 404 to anyone but the host', async () => {
    expect(await (await call('/api/me/tables/t-ana/tea-search?q=s', { actor: ana })).json()).toEqual({ matches: [] });
    expect(await (await call('/api/me/tables/t-ana/tea-search?q=%25%25', { actor: ana })).json()).toEqual({ matches: [] });
    expect((await call('/api/me/tables/t-ana/tea-search?q=sho', { actor: bo })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/tea-search?q=sho', { actor: adrian })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/tea-search?q=sho')).status).toBe(401);
    expect((await call('/api/me/tables/t-ana/tea-search?q=sho', { actor: ana, open: false })).status).toBe(404);
  });
});

describe('saving the teas', () => {
  it('keeps a shop tea, a chest tea and a typed name in pouring order, with no price anywhere', async () => {
    const saved = await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas: [
      { source: 'shop', product_id: 'p-shou', name: 'what the page showed' },
      { source: 'chest', product_id: 'p-ana', name: 'Shoulder of the mountain oolong', from: 'A friend in Alishan' },
      { source: 'name', name: 'Spring green from Mei' },
    ] } });
    expect(saved.status).toBe(200);
    const body = await saved.json() as { teas: Array<Record<string, unknown>> };
    expect(body.teas.map(tea => [tea.source, tea.name, tea.product_id, tea.brew_order, tea.from])).toEqual([
      ['shop', '2015 Shou Brick', 'p-shou', 1, null],
      ['chest', 'Shoulder of the mountain oolong', 'p-ana', 2, 'A friend in Alishan'],
      ['name', 'Spring green from Mei', null, 3, null],
    ]);
    expect(JSON.stringify(body)).not.toMatch(MONEY);
    // The record's own name is kept on the row, so the tea stays named wherever it is read.
    expect(menuRows().map(row => row.custom_name)).toEqual(['2015 Shou Brick', 'Shoulder of the mountain oolong', 'Spring green from Mei']);

    const detail = await (await call('/api/me/tables/t-ana', { actor: ana })).json() as { teas: Array<Record<string, unknown>> };
    expect(detail.teas).toEqual(body.teas);
    expect(JSON.stringify(detail.teas)).not.toMatch(MONEY);

    // Take the middle one off and move the name first: the rest keep their ids.
    const [shou, , named] = body.teas;
    const again = await (await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas: [named, shou] } })).json() as { teas: Array<Record<string, unknown>> };
    expect(again.teas.map(tea => [tea.id, tea.brew_order])).toEqual([[named.id, 1], [shou.id, 2]]);
    expect(menuRows()).toHaveLength(2);
  });

  it('keeps any tea that is not a public Teajia tea or the host’s own as its plain name, never linked', async () => {
    const teas = ['p-draft', 'p-hidden', 'p-private', 'p-archived', 'p-cup', 'p-cy', 'p-bo', 'p-missing']
      .map(id => ({ source: 'shop', product_id: id, name: `Typed ${id}` }));
    teas.push({ source: 'chest', product_id: 'p-bo', name: 'Typed chest p-bo' }, { source: 'chest', product_id: 'p-shou', name: 'Typed chest p-shou' });
    const response = await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas } });
    expect(response.status).toBe(200);
    const body = await response.json() as { teas: Array<Record<string, unknown>> };
    expect(body.teas.every(tea => tea.source === 'name' && tea.product_id === null)).toBe(true);
    expect(body.teas.map(tea => tea.name)).toEqual(teas.map(tea => tea.name));
    expect(menuRows().every(row => row.product_id === null)).toBe(true);
  });

  it('answers 404 to another host and the shop owner, and refuses a photograph from elsewhere', async () => {
    const list = { teas: [{ source: 'name', name: 'Anything' }] };
    expect((await call('/api/me/tables/t-ana/teas', { actor: bo, method: 'PUT', body: list })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/teas', { actor: adrian, method: 'PUT', body: list })).status).toBe(404);
    expect(menuRows()).toHaveLength(0);
    const elsewhere = await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas: [
      { source: 'name', name: 'Anything', photo_url: 'https://media.teajia.co/accounts/bo-personal/host-teas/t-bo/x.jpg' },
    ] } });
    expect(elsewhere.status).toBe(400);
    expect((await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas: [{ source: 'name', name: '  ' }] } })).status).toBe(400);
  });

  it('keeps a framed photograph under the table’s own folder and lets the host use it', async () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])], 'tea.jpg', { type: 'image/jpeg' }));
    const upload = await call('/api/me/tables/t-ana/teas/photo', { actor: ana, method: 'POST', form });
    expect(upload.status).toBe(201);
    const { url } = await upload.json() as { url: string };
    expect(url).toMatch(/^https:\/\/media\.teajia\.co\/accounts\/ana-personal\/host-teas\/t-ana\/[0-9a-f-]+\.jpg$/);
    expect([...stored.keys()]).toEqual([url.replace('https://media.teajia.co/', '')]);
    const saved = await (await call('/api/me/tables/t-ana/teas', { actor: ana, method: 'PUT', body: { teas: [
      { source: 'name', name: 'Spring green', photo_url: url },
    ] } })).json() as { teas: Array<Record<string, unknown>> };
    expect(saved.teas[0].photo_url).toBe(url);
    expect((await call('/api/me/tables/t-ana/teas/photo', { actor: bo, method: 'POST', form })).status).toBe(404);
  });
});

describe('Contract B: a tea crosses accounts only to a public tea of Teajia’s shop', () => {
  // Rows put on the menu directly, past the host's save, the way an older
  // route or a later change could leave them.
  const BAD = ['p-draft', 'p-hidden', 'p-private', 'p-archived', 'p-cy', 'p-missing', 'p-bo'];
  function seedMenu() {
    const insert = db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order)
      VALUES (?, 'ana-personal', 't-ana', ?, ?, ?)`);
    insert.run('m-shou', 'p-shou', '2015 Shou Brick', 1);
    // p-missing stands for a product deleted after it was listed.
    db.sqlite.exec('PRAGMA foreign_keys = OFF');
    BAD.forEach((id, index) => insert.run(`m-${id}`, id, `Name of ${id}`, index + 2));
    db.sqlite.exec('PRAGMA foreign_keys = ON');
  }

  it('the session’s public tea list links the shop tea and gives every other one its name only', async () => {
    seedMenu();
    const response = await call('/api/events/slug-t-ana/tea-menu');
    expect(response.status).toBe(200);
    const rows = await response.json() as Array<Record<string, unknown>>;
    const shou = rows.find(row => row.id === 'm-shou')!;
    expect(shou).toMatchObject({ product_id: 'p-shou', shop_path: '/shop/product/p-shou-slug?store=teajia-shop', product_name: '2015 Shou Brick' });
    for (const id of BAD) {
      const row = rows.find(item => item.id === `m-${id}`)!;
      expect(row).toMatchObject({ custom_name: `Name of ${id}`, product_id: null, shop_path: null, product_name: null, given_name: null });
    }
    expect(JSON.stringify(rows)).not.toMatch(/price|cost|stock/i);
    for (const id of BAD) expect(JSON.stringify(rows)).not.toContain(`"${id}"`);
  });

  it('the guest’s own page gives the same answer', async () => {
    seedMenu();
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status)
      VALUES ('g-1', 'ana-personal', 't-ana', 'Mei', 'magic-g1', 'confirmed')`).run();
    const response = await call('/api/rsvp/magic-g1');
    expect(response.status).toBe(200);
    const { tea_menu: menu } = await response.json() as { tea_menu: Array<Record<string, unknown>> };
    expect(menu.find(row => row.id === 'm-shou')).toMatchObject({ product_id: 'p-shou', product_name: '2015 Shou Brick' });
    for (const id of BAD) {
      expect(menu.find(row => row.id === `m-${id}`)).toMatchObject({ custom_name: `Name of ${id}`, product_id: null, product_name: null });
    }
    for (const id of BAD) expect(JSON.stringify(menu)).not.toContain(`"${id}"`);
  });

  it('the served list and the resolved teas (recap, thank-you) link only the shop tea', async () => {
    seedMenu();
    const served = (await readSessionServedTeas(db as never, 'ana-personal', 't-ana')).results;
    expect(served.find(row => row.id === 'm-shou')?.product_id).toBe('p-shou');
    for (const id of BAD) expect(served.find(row => row.id === `m-${id}`)?.product_id ?? null).toBeNull();

    const readPublic = vi.fn(async (accountId: string, productId: string) => {
      const row = db.sqlite.prepare(`SELECT * FROM products WHERE id = ? AND account_id = ?`).get(productId, accountId) as Record<string, unknown> | undefined;
      return row ? { ...row, orders_paused: false } : null;
    });
    const refs = [{ menuId: 'm-shou', productId: 'p-shou', name: '2015 Shou Brick' },
      ...BAD.map(id => ({ menuId: `m-${id}`, productId: id, name: `Name of ${id}` })),
      { menuId: 'm-chest', productId: null, chestId: 'cellar-of-bo', name: 'A chest tea of Bo' }];
    const teas = await resolveSessionTeas(db as never, readPublic, 'ana-personal', [], refs);
    expect(teas[0]).toMatchObject({ kind: 'tea', href: '/shop/product/p-shou-slug?store=teajia-shop' });
    for (const tea of teas.slice(1)) {
      expect(tea).toEqual({ kind: 'name', id: tea.id, name: expect.any(String) });
    }
    // The shop was never asked about a tea that may not cross.
    expect(readPublic.mock.calls.map(([, productId]) => productId)).toEqual(['p-shou']);
  });
});
