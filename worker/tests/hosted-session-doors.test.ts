// Launch 2, slices H2 and H7 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// hard questions 3, 4, 6 and 9).
//
// H2: an approved host's table opens by its link while their own account stays
// private. Every door a session can be opened by, and every list it could be
// found in, is tried here: the private account's session is found by nothing
// but its link; by request needs the host's yes; an unapproved person's
// session opens nowhere; a stopped host's sessions close; an order from such
// a session names its host.
//
// H7: the way to the house (address, map link, venue guide, venue photos) is
// shown only to a confirmed guest and only until the session ends; its
// photographs are served private and short-lived; a guest's own link reaches
// only the owner and the session's host, in the admin and in the agent tools.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { eventsToolModule } from '../src/mcpTools/events';
import { recordOrderSessionSource } from '../src/orderSessionSource';
import { isWalkthroughMedia, mayShowWalkthrough, SESSION_DEFAULT_HOURS, sessionEndsAt, sessionHasEnded } from '../src/sessionWalkthrough';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-doors-secret';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A wall time in UTC, the way the admin form stores one. */
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString().slice(0, 16);

type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana Lestari', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-personal' };
const cy: Actor = { userId: 'cy', name: 'Cy', accountId: 'cy-shop' };
const sam: Actor = { userId: 'sam', name: 'Sam', accountId: 'shop' };
const lee: Actor = { userId: 'lee', name: 'Lee', accountId: 'shop' };

const ADDRESS = 'Jalan Rahasia 7';
const MAP = 'https://maps.example/secret-house';
const GUIDE = JSON.stringify({
  steps: [{ description: 'Blue gate by the frangipani', image_url: 'https://media.teajia.co/accounts/ana-personal/venue-guide/gate.jpg' }],
  parking_notes: 'Behind the bakery',
});
// House photographs may be shown (Adrian, 2026-11-26), so house-front.jpg is not a secret.
const SECRETS = ['Jalan Rahasia', 'secret-house', 'frangipani', 'gate.jpg', 'bakery'];

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean; env?: Record<string, unknown> } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: open ? 'true' : 'false',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
    ...options.env,
  } as never, { waitUntil: () => undefined } as never);
}

const read = async (response: Response) => ({ status: response.status, text: await response.text(), headers: response.headers });

/** A personal account the way ensurePersonalInventoryAccount makes one. */
function personalAccount(actor: Actor, approved: boolean) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(actor.accountId, actor.accountId, `${actor.name}’s Tea Chest`, actor.userId, actor.userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  if (approved) db.sqlite.prepare('UPDATE users SET host_approved_at = ? WHERE id = ?').run('2026-11-26T00:00:00Z', actor.userId);
}

type TableOptions = {
  hostUserId?: string | null; door?: 'request' | 'link'; date?: string; end?: string | null;
  visibility?: string; discovery?: number; lifecycle?: string; venueId?: string | null;
};

function table(id: string, accountId: string, options: TableOptions = {}) {
  const door = options.door ?? 'request';
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, event_end_date, total_capacity, timezone,
      door, requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status,
      location_name, area_hint, address_text, map_link, venue_guide, venue_id)
    VALUES (?, ?, ?, ?, ?, ?, 6, 'UTC', ?, ?, ?, ?, ?, 'active', ?, 'At home', 'Near the market', ?, ?, ?, ?)`)
    .run(id, accountId, slugOf(id), `Table ${id}`, options.date ?? at(7 * DAY), options.end ?? null,
      door, door === 'request' ? 1 : 0, options.visibility ?? 'unlisted', options.discovery ?? 0,
      options.hostUserId === undefined ? null : options.hostUserId, options.lifecycle ?? 'published',
      ADDRESS, MAP, GUIDE, options.venueId ?? null);
}
const slugOf = (id: string) => `${id}-k3x9q2m7wz`;

function guest(id: string, eventId: string, accountId: string, status: string) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, status, magic_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `+62 811 000 ${id}`, status, `token-${id}`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-${id}`, accountId, eventId, id, `Guest ${id}`,
      status === 'confirmed' ? 'confirmed' : 'requested');
}

/** A published person page tied to an account, the way contributor pages are. */
function contributor(id: string, accountId: string, displayName: string, userId: string) {
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published) VALUES (?, ?, ?, ?, 1)`)
    .run(id, accountId, displayName, userId);
  db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES (?, ?)`).run(id, accountId);
}

/** Every door a stranger holding the link can knock on, by slug. */
async function slugDoors(slug: string, open = true) {
  return {
    page: (await call(`/api/events/${slug}/public`, { open })).status,
    teas: (await call(`/api/events/${slug}/tea-menu`, { open })).status,
    seats: (await call(`/api/events/${slug}/availability`, { open })).status,
    seat: (await call(`/api/events/${slug}/rsvp`, { open, method: 'POST', body: { full_name: 'Stranger', phone_number: '+62 811 999 000' } })).status,
    find: (await call(`/api/events/${slug}/find-rsvp`, { open, method: 'POST', body: { phone_number: '+62 811 000 111' } })).status,
    interest: (await call(`/api/events/${slug}/interest`, { open, method: 'POST', body: { name: 'Curious' } })).status,
  };
}

const closed = { page: 404, teas: 404, seats: 404, seat: 404, find: 404, interest: 404 };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, public_enabled = 1, status = 'active' WHERE id = ?`).run(adrian.accountId);
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-unused`, publicEnabled: false });
    db.sqlite.prepare('UPDATE users SET name = ? WHERE id = ?').run(person.name, person.userId);
  }
  seedIdentity(db, { userId: cy.userId, accountId: cy.accountId });
  personalAccount(ana, true);
  personalAccount(bo, false);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('H2: an approved host’s table opens by its link', () => {
  it('opens the session page, its teas, its seats and a seat, and names the host in plain words', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    db.sqlite.prepare(`INSERT INTO event_tea_menu (id, event_id, account_id, custom_name, brew_order) VALUES ('m1', 'ana-table', ?, 'Old tree', 1)`)
      .run(ana.accountId);
    const slug = slugOf('ana-table');

    const page = await read(await call(`/api/events/${slug}/public`));
    expect(page.status).toBe(200);
    const body = JSON.parse(page.text);
    expect(body.host).toEqual({ name: 'Ana', path: null });
    expect(body.pouring).toEqual([]);
    // The private account is not named or shown: no shop name, no slug, no country.
    expect(body.account_name).toBe('Ana');
    expect(page.text).not.toContain('Tea Chest');
    expect(page.text).not.toContain('ana-personal');
    expect(page.text).not.toContain('Lestari');
    expect(page.text).not.toContain('host_user_id');
    for (const secret of SECRETS) expect(page.text).not.toContain(secret);
    expect(page.headers.get('Cache-Control')).toBe('private, no-store');

    const teas = await read(await call(`/api/events/${slug}/tea-menu`));
    expect(teas.status).toBe(200);
    expect(teas.text).toContain('Old tree');
    expect((await call(`/api/events/${slug}/availability`)).status).toBe(200);

    const seat = await call(`/api/events/${slug}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 222 333' } });
    expect(seat.status).toBe(201);
    expect((await seat.json() as { status: string }).status).toBe('requested');
  });

  it('names a host with a published page by that page', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    contributor('ana-page', ana.accountId, 'Ana L.', 'ana');
    const body = await (await call(`/api/events/${slugOf('ana-table')}/public`)).json() as Record<string, unknown>;
    expect(body.host).toEqual({ name: 'Ana L.', path: '/people/ana-page' });
  });

  it('is found by no list, store page, profile, recap or public agent tool, even if it were marked public', async () => {
    // The worst case: the row itself says public and discoverable. The account gate still holds.
    table('ana-table', ana.accountId, { hostUserId: 'ana', visibility: 'public', discovery: 1 });
    table('shop-night', adrian.accountId, { visibility: 'public', discovery: 1 });
    contributor('ana-page', ana.accountId, 'Ana L.', 'ana');
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES ('ec1', ?, 'ana-table', 'ana-page', 'lead_host', 1)`)
      .run(ana.accountId);
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type, status, is_public) VALUES ('ana-tea', ?, 'Ana tea', 'Oolong', 'Active', 1)`)
      .run(ana.accountId);
    db.sqlite.prepare(`INSERT INTO event_tea_menu (id, event_id, account_id, product_id, brew_order) VALUES ('m1', 'ana-table', ?, 'ana-tea', 1)`)
      .run(ana.accountId);
    const hosted = slugOf('ana-table');

    // The link still opens it.
    expect((await call(`/api/events/${hosted}/public`)).status).toBe(200);

    const network = await read(await call('/api/events'));
    expect(network.status).toBe(200);
    expect(network.text).toContain(slugOf('shop-night'));
    expect(network.text).not.toContain(hosted);

    expect((await call(`/api/s/${ana.accountId}/events`)).status).toBe(404);
    expect((await call(`/api/s/${ana.accountId}`)).status).toBe(404);
    expect((await call(`/api/s/${ana.accountId}/products`)).status).toBe(404);
    expect(await (await call('/api/network/stores')).text()).not.toContain(ana.accountId);

    // Product events: a stranger, signed out or signed in elsewhere.
    expect(await (await call('/api/products/ana-tea/events')).text()).not.toContain(hosted);
    expect(await (await call('/api/products/ana-tea/events', { actor: cy })).text()).not.toContain(hosted);

    // The host's profile does not list it as hosting.
    const profile = await read(await call('/api/people/ana-page'));
    expect(profile.text).not.toContain(hosted);

    // Public agent tools carry no sessions, and never answer as the private account.
    const tools = await read(await call('/mcp/public', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }));
    expect(tools.status).toBe(200);
    expect(tools.text).not.toMatch(/event|session/i);
    const shop = await (await call(`/mcp/public?account=${ana.accountId}`)).json() as { shop: { slug: string } | null };
    expect(shop.shop?.slug).not.toBe(ana.accountId);

    // Finished, with a published recap: still no recap anywhere.
    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'completed', recap_status = 'published' WHERE id = 'ana-table'`).run();
    db.sqlite.prepare(`INSERT INTO event_post_session (id, event_id, account_id, session_notes) VALUES ('ps1', 'ana-table', ?, 'A quiet evening')`)
      .run(ana.accountId);
    expect((await call(`/api/events/${hosted}/recap`)).status).toBe(404);
    expect((await call(`/api/public/sit-recaps/${hosted}`)).status).toBe(404);
    expect(await (await call('/api/public/sit-links/people/ana-page')).text()).not.toContain(hosted);
  });

  it('keeps an older session in a Tea Chest, made without a host, closed', async () => {
    table('ana-old', ana.accountId, { hostUserId: null });
    expect(await slugDoors(slugOf('ana-old'))).toEqual(closed);
  });

  it('opens nothing of an unapproved person’s session', async () => {
    table('bo-table', bo.accountId, { hostUserId: 'bo' });
    guest('bo-guest', 'bo-table', bo.accountId, 'confirmed');
    db.sqlite.prepare(`INSERT INTO guest_invites (id, account_id, event_id, parent_attendee_id, invite_token, status) VALUES ('gi', ?, 'bo-table', 'bo-guest', 'invite-bo', 'pending')`)
      .run(bo.accountId);
    expect(await slugDoors(slugOf('bo-table'))).toEqual(closed);
    expect((await call('/api/guest-invite/invite-bo')).status).toBe(404);
    expect((await call('/api/guest-invite/invite-bo/claim', { method: 'POST', body: { name: 'Plus', phone: '+62 811 444' } })).status).toBe(404);
    const page = await read(await call('/api/rsvp/token-bo-guest'));
    for (const secret of SECRETS) expect(page.text).not.toContain(secret);
  });

  it('opens nothing while the launch is closed', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    expect(await slugDoors(slugOf('ana-table'), false)).toEqual(closed);
  });

  it('needs the host’s yes at a by-request door before the way is shown', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana', door: 'request' });
    const seat = await call(`/api/events/${slugOf('ana-table')}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 222 333' } });
    expect(seat.status).toBe(201);
    const { magic_token: token, status } = await seat.json() as { magic_token: string; status: string };
    expect(status).toBe('requested');
    const waiting = await read(await call(`/api/rsvp/${token}`));
    expect(waiting.status).toBe(200);
    for (const secret of SECRETS) expect(waiting.text).not.toContain(secret);

    const attendee = db.sqlite.prepare('SELECT id FROM event_attendees WHERE magic_token = ?').get(token) as { id: string };
    const yes = await call(`/api/admin/attendees/${attendee.id}/approve`, { actor: ana, method: 'PUT', body: {} });
    expect(yes.status).toBe(200);
    const confirmed = JSON.parse((await read(await call(`/api/rsvp/${token}`))).text);
    expect(confirmed.event.address_text).toBe(ADDRESS);
    expect(confirmed.event.map_link).toBe(MAP);
    expect(confirmed.event.venue_guide).toBe(GUIDE);
  });

  it('seats a guest at once at a by-link door', async () => {
    table('ana-link', ana.accountId, { hostUserId: 'ana', door: 'link' });
    const seat = await call(`/api/events/${slugOf('ana-link')}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 222 333' } });
    expect(seat.status).toBe(201);
    expect((await seat.json() as { status: string }).status).toBe('confirmed');
  });

  it('closes a stopped host’s sessions at once, and opens them again on a new yes', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    guest('kept', 'ana-table', ana.accountId, 'confirmed');
    guest('waiting', 'ana-table', ana.accountId, 'waitlist');
    db.sqlite.prepare(`UPDATE event_attendees SET claim_expires_at = ? WHERE id = 'waiting'`).run(new Date(Date.now() + HOUR).toISOString());
    const slug = slugOf('ana-table');
    expect((await call(`/api/events/${slug}/public`)).status).toBe(200);

    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: false } })).status).toBe(200);
    expect(await slugDoors(slug)).toEqual(closed);
    // The guest keeps their page and their record, but not the way in, and no new seat is taken.
    const page = await read(await call('/api/rsvp/token-kept'));
    expect(page.status).toBe(200);
    for (const secret of SECRETS) expect(page.text).not.toContain(secret);
    expect((await call('/api/rsvp/token-waiting/claim', { method: 'POST' })).status).toBe(404);
    expect(db.sqlite.prepare(`SELECT status FROM event_attendees WHERE id = 'kept'`).get()).toEqual({ status: 'confirmed' });

    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: true } })).status).toBe(200);
    expect((await call(`/api/events/${slug}/public`)).status).toBe(200);
    expect(JSON.parse((await read(await call('/api/rsvp/token-kept'))).text).event.address_text).toBe(ADDRESS);
  });

  it('leaves the shop’s own sessions as they were', async () => {
    table('shop-night', adrian.accountId, { visibility: 'unlisted' });
    expect((await call(`/api/events/${slugOf('shop-night')}/public`)).status).toBe(200);
    expect((await call(`/api/events/${slugOf('shop-night')}/public`, { open: false })).status).toBe(200);
    // A shop that is not public still does not open, whatever the launch.
    table('cy-night', cy.accountId);
    db.sqlite.prepare(`UPDATE accounts SET public_enabled = 0 WHERE id = ?`).run(cy.accountId);
    expect((await call(`/api/events/${slugOf('cy-night')}/public`)).status).toBe(404);
  });
});

describe('H2: an order from a hosted table names its host', () => {
  function finished(id: string, accountId: string, hostUserId: string | null, ref: string) {
    table(id, accountId, { hostUserId, lifecycle: 'completed' });
    db.sqlite.prepare('UPDATE events SET thanks_ref = ? WHERE id = ?').run(ref, id);
  }
  function inquiry(id: string, accountId: string) {
    db.sqlite.prepare(`INSERT INTO inquiries (id, account_id, name, email, items, ref_number) VALUES (?, ?, 'Buyer', 'buyer@test.dev', '[]', ?)`).run(id, accountId, `REF-${id}`);
  }
  const source = (id: string) => db.sqlite.prepare('SELECT account_id, event_id, host_user_id FROM order_session_sources WHERE inquiry_id = ?').get(id);

  it('records the host from host_user_id for an order in the platform owner’s shop', async () => {
    finished('ana-done', ana.accountId, 'ana', 'aaaaaaaaaaaaaaaaaa');
    inquiry('q1', adrian.accountId);
    expect(await recordOrderSessionSource(db as unknown as D1Database, 'q1', 'aaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(source('q1')).toEqual({ account_id: adrian.accountId, event_id: 'ana-done', host_user_id: 'ana' });
  });

  it('prefers host_user_id over a lead host contributor, and falls back to the lead host', async () => {
    seedIdentity(db, { userId: 'lee', accountId: 'lee-unused' });
    contributor('lee-page', adrian.accountId, 'Lee', 'lee');
    finished('shop-done', adrian.accountId, 'ana', 'bbbbbbbbbbbbbbbbbb');
    finished('shop-led', adrian.accountId, null, 'cccccccccccccccccc');
    for (const id of ['shop-done', 'shop-led']) {
      db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role) VALUES (?, ?, ?, 'lee-page', 'lead_host')`)
        .run(`ec-${id}`, adrian.accountId, id);
    }
    inquiry('q2', adrian.accountId);
    inquiry('q3', adrian.accountId);
    await recordOrderSessionSource(db as unknown as D1Database, 'q2', 'bbbbbbbbbbbbbbbbbb');
    await recordOrderSessionSource(db as unknown as D1Database, 'q3', 'cccccccccccccccccc');
    expect(source('q2')).toMatchObject({ host_user_id: 'ana' });
    expect(source('q3')).toMatchObject({ host_user_id: 'lee' });
  });

  it('writes nothing for any other crossing of accounts', async () => {
    finished('cy-done', cy.accountId, 'cy', 'dddddddddddddddddd');
    finished('ana-done', ana.accountId, 'ana', 'eeeeeeeeeeeeeeeeee');
    finished('ana-old', ana.accountId, null, 'ffffffffffffffffff');
    inquiry('q-shop', adrian.accountId);
    inquiry('q-cy', cy.accountId);
    inquiry('q-old', adrian.accountId);
    // A shop's session, ordered in another shop.
    expect(await recordOrderSessionSource(db as unknown as D1Database, 'q-shop', 'dddddddddddddddddd')).toBe(false);
    // A hosted table, ordered in a shop that is not the platform owner's.
    expect(await recordOrderSessionSource(db as unknown as D1Database, 'q-cy', 'eeeeeeeeeeeeeeeeee')).toBe(false);
    // A Tea Chest session that is not a hosted table.
    expect(await recordOrderSessionSource(db as unknown as D1Database, 'q-old', 'ffffffffffffffffff')).toBe(false);
  });
});

describe('H7: the way to the house', () => {
  function withVenue(eventId: string, accountId: string) {
    db.sqlite.prepare(`INSERT INTO venues (id, account_id, name, address, photos) VALUES ('house', ?, 'The house', ?, ?)`)
      .run(accountId, ADDRESS, JSON.stringify(['https://media.teajia.co/accounts/ana-personal/venues/house-front.jpg']));
    db.sqlite.prepare(`UPDATE events SET venue_id = 'house' WHERE id = ?`).run(eventId);
  }
  const way = async (token: string) => {
    const response = await read(await call(`/api/rsvp/${token}`));
    const event = JSON.parse(response.text).event;
    return { response, shown: event.address_text === ADDRESS && event.map_link === MAP && event.venue_guide === GUIDE };
  };

  it('is shown to a confirmed seat only, and leaves the moment the seat does', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    withVenue('ana-table', ana.accountId);
    for (const status of ['confirmed', 'requested', 'waitlist', 'denied', 'cancelled']) guest(status, 'ana-table', ana.accountId, status);

    const confirmed = await way('token-confirmed');
    expect(confirmed.shown).toBe(true);
    expect(confirmed.response.headers.get('Cache-Control')).toBe('private, no-store');
    for (const status of ['requested', 'waitlist', 'denied', 'cancelled']) {
      const other = await way(`token-${status}`);
      expect(other.shown, status).toBe(false);
      for (const secret of SECRETS) expect(other.response.text, status).not.toContain(secret);
    }
    // Photographs of the house may be shown to anyone; the address never.
    const publicText = await (await call(`/api/events/${slugOf('ana-table')}/public`)).text();
    expect(publicText).toContain('house-front');
    expect(publicText).not.toContain('Jalan Rahasia');

    for (const status of ['denied', 'waitlist', 'cancelled']) {
      db.sqlite.prepare(`UPDATE event_attendees SET status = 'confirmed' WHERE id = 'confirmed'`).run();
      expect((await way('token-confirmed')).shown).toBe(true);
      db.sqlite.prepare(`UPDATE event_attendees SET status = ? WHERE id = 'confirmed'`).run(status);
      expect((await way('token-confirmed')).shown, status).toBe(false);
    }
  });

  it('is shown until the session ends, and not after', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    withVenue('ana-table', ana.accountId);
    guest('g', 'ana-table', ana.accountId, 'confirmed');
    const set = (date: string, end: string | null, lifecycle = 'published') =>
      db.sqlite.prepare(`UPDATE events SET event_date = ?, event_end_date = ?, lifecycle_status = ? WHERE id = 'ana-table'`).run(date, end, lifecycle);

    set(at(-2 * HOUR), null);
    expect((await way('token-g')).shown).toBe(true);
    set(at(-(SESSION_DEFAULT_HOURS + 1) * HOUR), null);
    expect((await way('token-g')).shown).toBe(false);
    set(at(-30 * 60 * 1000), at(-60 * 1000));
    expect((await way('token-g')).shown).toBe(false);
    set(at(-5 * HOUR), at(HOUR));
    expect((await way('token-g')).shown).toBe(true);
    set(at(DAY), null, 'completed');
    expect((await way('token-g')).shown).toBe(false);
    set(at(DAY), null, 'cancelled');
    expect((await way('token-g')).shown).toBe(false);
  });

  it('states one end rule: the end date when after the start, else the start plus the default', () => {
    const start = Date.parse('2026-12-01T18:00:00Z');
    expect(sessionEndsAt({ event_date: '2026-12-01T18:00', timezone: 'UTC' })).toBe(start + SESSION_DEFAULT_HOURS * HOUR);
    expect(sessionEndsAt({ event_date: '2026-12-01T18:00', event_end_date: '2026-12-01T20:30', timezone: 'UTC' })).toBe(start + 2.5 * HOUR);
    // An end before the start (an end written in another clock) is not trusted.
    expect(sessionEndsAt({ event_date: '2026-12-01T18:00', event_end_date: '2026-12-01T10:00', timezone: 'UTC' })).toBe(start + SESSION_DEFAULT_HOURS * HOUR);
    // A wall time is read in the session's own zone: 18:00 in Bali is 10:00 UTC.
    expect(sessionEndsAt({ event_date: '2026-12-01T18:00', timezone: 'Asia/Makassar' })).toBe(Date.parse('2026-12-01T10:00:00Z') + SESSION_DEFAULT_HOURS * HOUR);
    expect(sessionEndsAt({ event_date: '2026-12-01T18:00:00.000Z', timezone: 'Asia/Makassar' })).toBe(start + SESSION_DEFAULT_HOURS * HOUR);
    // A date with no time ends at the end of that day.
    expect(sessionEndsAt({ event_date: '2026-12-01', timezone: 'UTC' })).toBe(Date.parse('2026-12-02T00:00:00Z'));
    expect(sessionEndsAt({ event_date: 'soon' })).toBeNull();
    expect(sessionHasEnded({ event_date: 'soon', lifecycle_status: 'archived' })).toBe(true);
    expect(mayShowWalkthrough('confirmed', { event_date: '2999-01-01T00:00' }, true)).toBe(true);
    expect(mayShowWalkthrough('confirmed', { event_date: '2999-01-01T00:00' }, false)).toBe(false);
    expect(mayShowWalkthrough('requested', { event_date: '2999-01-01T00:00' }, true)).toBe(false);
  });

  it('serves its photographs private and short-lived, and other photographs as before', async () => {
    table('shop-night', adrian.accountId);
    db.sqlite.prepare(`UPDATE events SET venue_guide = ? WHERE id = 'shop-night'`)
      .run(JSON.stringify({ steps: [{ description: 'Old step', image_url: 'https://media.teajia.co/accounts/shop/flyers/old-step.jpg' }] }));
    const bucket = {
      get: async (key: string) => ({
        writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/jpeg'),
        httpEtag: `"${key}"`, body: 'jpeg',
      }),
    };
    const cache = async (key: string) => (await call(`/api/media/${key}`, { env: { MEDIA_BUCKET: bucket } })).headers.get('Cache-Control');
    expect(await cache('accounts/shop/venues/room.jpg')).toBe('private, max-age=300');
    expect(await cache('accounts/ana-personal/venue-guide/gate.jpg')).toBe('private, max-age=300');
    expect(await cache('accounts/shop/flyers/old-step.jpg')).toBe('private, max-age=300');
    expect(await cache('accounts/shop/flyers/poster.jpg')).toBe('public, max-age=31536000, immutable');
    expect(await cache('accounts/shop/products/tea.jpg')).toBe('public, max-age=31536000, immutable');
    expect(await isWalkthroughMedia(db as unknown as D1Database, 'accounts/cy-shop/flyers/old-step.jpg')).toBe(false);
  });

  it('keeps a new step photograph apart from flyers', async () => {
    const puts: string[] = [];
    const bucket = { put: async (key: string) => { puts.push(key); } };
    const upload = async (purpose?: string) => {
      const form = new FormData();
      form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], 'step.jpg', { type: 'image/jpeg' }));
      if (purpose) form.append('purpose', purpose);
      const token = await signedToken(SECRET, { sub: adrian.userId, name: 'Adrian', email: 'adrian@test.dev', active_account_id: adrian.accountId, role: 'user' });
      return worker.fetch(new Request('https://worker.test/api/upload-flyer', {
        method: 'POST', body: form, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': adrian.accountId },
      }), { DB: db, JWT_SECRET: SECRET, MEDIA_BUCKET: bucket, PROVIDER_LIMITER: allow } as never, { waitUntil: () => undefined } as never);
    };
    expect((await upload('venue-guide')).status).toBe(201);
    expect((await upload()).status).toBe(201);
    expect(puts[0]).toMatch(/^accounts\/shop\/venue-guide\//);
    expect(puts[1]).toMatch(/^accounts\/shop\/flyers\//);
  });
});

describe('H7: a guest’s own link reaches only the owner and the session’s host', () => {
  beforeEach(() => {
    seedIdentity(db, { userId: sam.userId, accountId: adrian.accountId, role: 'staff', bundles: ['gather'] });
    seedIdentity(db, { userId: lee.userId, accountId: adrian.accountId, role: 'staff', bundles: ['gather'] });
    table('lee-night', adrian.accountId, { hostUserId: null });
    table('ana-night', adrian.accountId, { hostUserId: 'ana' });
    contributor('lee-page', adrian.accountId, 'Lee', 'lee');
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role) VALUES ('ec-lee', ?, 'lee-night', 'lee-page', 'lead_host')`)
      .run(adrian.accountId);
    guest('at-lee', 'lee-night', adrian.accountId, 'requested');
    guest('at-ana', 'ana-night', adrian.accountId, 'requested');
  });

  const tokensIn = async (actor: Actor, path: string) => {
    const response = await call(path, { actor });
    expect(response.status, `${actor.userId} ${path}`).toBe(200);
    const rows = await response.json() as Array<Record<string, unknown>>;
    return rows.filter(row => row.magic_token).map(row => String(row.magic_token)).sort();
  };

  it('in the guest lists', async () => {
    expect(await tokensIn(adrian, '/api/admin/events/lee-night/attendees')).toEqual(['token-at-lee']);
    expect(await tokensIn(lee, '/api/admin/events/lee-night/attendees')).toEqual(['token-at-lee']);
    expect(await tokensIn(sam, '/api/admin/events/lee-night/attendees')).toEqual([]);
    expect(await tokensIn(lee, '/api/admin/events/ana-night/attendees')).toEqual([]);

    expect(await tokensIn(adrian, '/api/admin/pending-attendees')).toEqual(['token-at-ana', 'token-at-lee']);
    expect(await tokensIn(lee, '/api/admin/pending-attendees')).toEqual(['token-at-lee']);
    expect(await tokensIn(sam, '/api/admin/pending-attendees')).toEqual([]);
    // Staff still see who is waiting, only without the link.
    const rows = await (await call('/api/admin/pending-attendees', { actor: sam })).json() as unknown[];
    expect(rows).toHaveLength(2);
  });

  it('in the message a yes prepares', async () => {
    const bySam = await (await call('/api/admin/attendees/at-ana/approve', { actor: sam, method: 'PUT', body: {} })).json() as { whatsapp_notify_url: string };
    expect(bySam.whatsapp_notify_url).toBeTruthy();
    expect(decodeURIComponent(bySam.whatsapp_notify_url)).not.toContain('token-at-ana');
    const byLee = await (await call('/api/admin/attendees/at-lee/approve', { actor: lee, method: 'PUT', body: {} })).json() as { whatsapp_notify_url: string };
    expect(decodeURIComponent(byLee.whatsapp_notify_url)).toContain('/m/token-at-lee');
  });

  it('in the agent tools', async () => {
    const H = eventsToolModule.handlers;
    const record = async (auth: Record<string, unknown>, eventId: string) => {
      const args = { event_id: eventId, full_name: 'Maria', phone_number: `+62 811 234 ${String(auth.userId).length}${eventId.length}`, hold_for_approval: false };
      const preview = await H.record_event_rsvp({ DB: db as unknown as D1Database }, auth as never, args) as { confirmation_token: string };
      return await H.record_event_rsvp({ DB: db as unknown as D1Database }, auth as never, { ...args, confirm: preview.confirmation_token }) as Record<string, unknown>;
    };
    const base = { accountId: adrian.accountId, userEmail: 'x@test.dev', scopes: [] };
    const staff = await record({ ...base, userId: 'sam', tokenId: 't-sam', creatorTier: 'staff' }, 'ana-night');
    expect(staff.committed).toBe(true);
    expect(staff.rsvp_link).toBeNull();
    expect(JSON.stringify(staff)).not.toMatch(/\/m\//);
    const host = await record({ ...base, userId: 'lee', tokenId: 't-lee', creatorTier: 'staff' }, 'lee-night');
    expect(host.rsvp_link).toMatch(/^\/m\//);
    const owner = await record({ ...base, userId: 'adrian', tokenId: 't-adrian', creatorTier: 'platform_owner' }, 'ana-night');
    expect(owner.committed, JSON.stringify(owner)).toBe(true);
    expect(owner.rsvp_link).toMatch(/^\/m\//);
  });
});
