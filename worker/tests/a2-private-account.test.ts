// Launch 2, audit A2: a private account stays private
// (/mnt/project-files/guests-build/a2-private-account-audit.md). Each test is
// one finding's reproduction from the audit, turned round to pin the fix:
// F1 and F2, a step photograph only by an address signed for a seat that may
// still see the way (wayMedia.ts); F3, every guide write holds to the host
// page's own photo rule; F4, no private account's ids on the tea list, the
// guest page or the public answer; F5, a stopped host leaves the guest's page
// and thank-you open; F6, no seat once the session has ended; F8, one rule
// for who the host is; F9, tea search lists what the shop's browse list does;
// and a host's tea photographs are not kept at the edge for a year.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { issueAfterSitLink } from '../src/afterSitAccess';
import { guestLinkSessions } from '../src/guestLinkHolders';
import { sessionHostUserSql } from '../src/sessionHost';
import { WAY_MEDIA_ORIGIN as MEDIA } from '../src/wayMedia';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-a2-secret';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString().slice(0, 16);

type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana Lestari', accountId: 'ana-personal' };

const GATE = `${MEDIA}accounts/ana-personal/venue-guide/gate.jpg`;
const GUIDE = JSON.stringify({ steps: [{ description: 'Blue gate', image_url: GATE }] });

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };
const bucket = {
  get: async (key: string) => ({
    writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/jpeg'),
    httpEtag: `"${key}"`, body: 'jpeg',
  }),
};

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
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
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow, AFTER_SIT_LIMITER: allow,
    MEDIA_BUCKET: bucket,
  } as never, { waitUntil: () => undefined } as never);
}

function personalAccount(actor: Actor) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, `${actor.name}’s Tea Chest`, actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  db.sqlite.prepare('UPDATE users SET host_approved_at = ? WHERE id = ?').run('2026-11-26T00:00:00Z', actor.userId);
}

const slugOf = (id: string) => `${id}-k3x9q2m7wz`;

function table(id: string, accountId: string, options: { hostUserId?: string | null; door?: 'request' | 'link'; date?: string; lifecycle?: string } = {}) {
  const door = options.door ?? 'request';
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door, requires_approval,
      public_visibility, network_discovery, host_user_id, status, lifecycle_status, location_name, address_text, venue_guide, venue_id)
    VALUES (?, ?, ?, ?, ?, 6, 'UTC', ?, ?, 'unlisted', 0, ?, 'active', ?, 'At home', 'Jalan Rahasia 7', ?, NULL)`)
    .run(id, accountId, slugOf(id), `Table ${id}`, options.date ?? at(7 * DAY), door, door === 'request' ? 1 : 0,
      options.hostUserId === undefined ? null : options.hostUserId, options.lifecycle ?? 'published', GUIDE);
}

function guest(id: string, eventId: string, accountId: string, status: string) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, status, magic_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `+62 811 000 ${id}`, status, `token-${id}`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-${id}`, accountId, eventId, id, `Guest ${id}`,
      status === 'confirmed' ? 'confirmed' : 'requested');
}

/** The step photograph's address as the guest's page hands it out. */
async function guestPhoto(token: string): Promise<string | null> {
  const page = await (await call(`/api/rsvp/${token}`)).json() as { event: { venue_guide: string | null } };
  if (!page.event.venue_guide) return null;
  return JSON.parse(page.event.venue_guide).steps[0].image_url as string;
}

const fetchPhoto = async (url: string) => (await call(`/api/media/${url.slice(MEDIA.length)}`)).status;
const withdraw = () => call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: false } });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, public_enabled = 1, status = 'active' WHERE id = ?`).run(adrian.accountId);
  seedIdentity(db, { userId: ana.userId, accountId: 'ana-unused', publicEnabled: false });
  db.sqlite.prepare('UPDATE users SET name = ? WHERE id = ?').run(ana.name, ana.userId);
  personalAccount(ana);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('F1: a step photograph is served only while its seat may see the way', () => {
  it('refuses the bare address, and stops a signed one when the seat, the end or the host door does', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    guest('mei', 'ana-table', ana.accountId, 'confirmed');

    expect(await fetchPhoto(GATE)).toBe(404);
    const signed = await guestPhoto('token-mei');
    expect(signed).toMatch(/^https:\/\/media\.teajia\.co\/accounts\/ana-personal\/venue-guide\/gate\.jpg\?exp=\d+&for=mei&sig=[0-9a-f]{64}$/);
    expect(await fetchPhoto(signed!)).toBe(200);
    // A changed holder or signature is refused.
    expect(await fetchPhoto(signed!.replace('for=mei', 'for=host'))).toBe(404);
    expect(await fetchPhoto(signed!.replace(/sig=[0-9a-f]/, 'sig=0'))).toBe(404);

    db.sqlite.prepare(`UPDATE event_attendees SET status = 'cancelled' WHERE id = 'mei'`).run();
    expect(await guestPhoto('token-mei')).toBeNull();
    expect(await fetchPhoto(signed!)).toBe(404);

    db.sqlite.prepare(`UPDATE event_attendees SET status = 'confirmed' WHERE id = 'mei'`).run();
    expect(await fetchPhoto(signed!)).toBe(200);
    expect((await withdraw()).status).toBe(200);
    expect(await fetchPhoto(signed!)).toBe(404);
    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: true } })).status).toBe(200);
    expect(await fetchPhoto(signed!)).toBe(200);
    expect(await call(`/api/media/${signed!.slice(MEDIA.length)}`, { open: false }).then(r => r.status)).toBe(404);

    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'completed' WHERE id = 'ana-table'`).run();
    expect(await fetchPhoto(signed!)).toBe(404);
  });

  it('signs the guest’s photographs to expire no later than the session’s end', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana', date: at(-1 * HOUR) });
    guest('mei', 'ana-table', ana.accountId, 'confirmed');
    const signed = await guestPhoto('token-mei');
    const exp = Number(new URL(signed!).searchParams.get('exp'));
    // Default length is four hours, so the end is about three hours away.
    expect(exp * 1000).toBeLessThanOrEqual(Date.now() + 3 * HOUR + 60_000);
  });

  it('gives the host their own signed addresses, and leaves house photographs public', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    const way = await (await call('/api/me/tables/ana-table/way', { actor: ana })).json() as any;
    const hostUrl = way.way.venue_guide.steps[0].image_url as string;
    expect(hostUrl).toMatch(/for=host&sig=/);
    expect(await fetchPhoto(hostUrl)).toBe(200);
    expect(await fetchPhoto(`${MEDIA}accounts/ana-personal/venues/house-front.jpg`)).toBe(200);
  });
});

describe('F2: a guide reused at another table gives an earlier table’s guest nothing', () => {
  it('stops the first table’s guest once their table is over, while the second table’s guest is served', async () => {
    table('first', ana.accountId, { hostUserId: 'ana' });
    table('second', ana.accountId, { hostUserId: 'ana' });
    guest('old', 'first', ana.accountId, 'confirmed');
    guest('new', 'second', ana.accountId, 'confirmed');
    const oldUrl = await guestPhoto('token-old');
    const newUrl = await guestPhoto('token-new');
    expect(await fetchPhoto(oldUrl!)).toBe(200);

    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'completed' WHERE id = 'first'`).run();
    expect(await guestPhoto('token-old')).toBeNull();
    expect(await fetchPhoto(oldUrl!)).toBe(404);
    expect(await fetchPhoto(newUrl!)).toBe(200);
  });
});

describe('F3: every door that writes a guide holds to the host page’s photo rule', () => {
  const tracker = { steps: [{ description: 'Gate', image_url: 'https://tracker.example.test/pixel.gif' }] };

  it('refuses a foreign photograph on the admin event route, and stores its own photographs bare', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    guest('mei', 'ana-table', ana.accountId, 'confirmed');
    for (const venue_guide of [tracker, JSON.stringify(tracker),
      { steps: [{ description: 'Gate', image_url: `${MEDIA}accounts/bo-personal/venue-guide/x.jpg` }] }]) {
      const refused = await call('/api/admin/events/ana-table', { actor: ana, method: 'PUT', body: { venue_guide } });
      expect(refused.status).toBe(400);
      expect(await refused.json()).toMatchObject({ code: 'table_way_photo' });
    }
    expect(await guestPhoto('token-mei')).not.toContain('tracker');

    const signed = `${MEDIA}accounts/ana-personal/venue-guide/new.jpg?exp=1&for=host&sig=abc`;
    const saved = await call('/api/admin/events/ana-table', {
      actor: ana, method: 'PUT', body: { venue_guide: JSON.stringify({ steps: [{ description: 'New gate', image_url: signed }, { description: 'Old', image_url: GATE }] }) },
    });
    expect(saved.status).toBe(200);
    const row = db.sqlite.prepare(`SELECT venue_guide FROM events WHERE id = 'ana-table'`).get() as { venue_guide: string };
    expect(JSON.parse(row.venue_guide).steps.map((s: any) => s.image_url)).toEqual([`${MEDIA}accounts/ana-personal/venue-guide/new.jpg`, GATE]);
  });

  it('keeps an older flyer photograph the stored guide already names, and refuses a new one', async () => {
    table('shop-night', adrian.accountId);
    const flyer = `${MEDIA}accounts/shop/flyers/old-step.jpg`;
    db.sqlite.prepare(`UPDATE events SET venue_guide = ? WHERE id = 'shop-night'`).run(JSON.stringify({ steps: [{ description: 'Old', image_url: flyer }] }));
    const kept = await call('/api/admin/events/shop-night', { actor: adrian, method: 'PUT', body: { venue_guide: { steps: [{ description: 'Old, reworded', image_url: flyer }] } } });
    expect(kept.status).toBe(200);
    const added = await call('/api/admin/events/shop-night', { actor: adrian, method: 'PUT', body: { venue_guide: { steps: [{ description: 'New', image_url: `${MEDIA}accounts/shop/flyers/other.jpg` }] } } });
    expect(added.status).toBe(400);
  });

  it('refuses a foreign photograph on a new session and on a saved place', async () => {
    const created = await call('/api/admin/events', {
      actor: adrian, method: 'POST', body: { slug: 'a2-new', title: 'New', event_date: at(DAY), total_capacity: 4, venue_guide: JSON.stringify(tracker) },
    });
    expect(created.status).toBe(400);
    const place = await call('/api/admin/locations', { actor: adrian, method: 'POST', body: { name: 'House', address: 'Here', venue_guide: JSON.stringify(tracker) } });
    expect(place.status).toBe(400);
  });
});

describe('F4: no private account’s ids on the tea list, the guest page or the public answer', () => {
  beforeEach(() => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    guest('mei', 'ana-table', ana.accountId, 'confirmed');
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, given_name, type, status, is_public, shown_in_shop,
        stock_grams, cost_amount, cost_currency, image_url)
      VALUES ('chest-1', 'ana-personal', 'Old Shou', 'Old Shou', 'Shou', 'Active', 0, 0, 100, 10, 'Yuan', ?)`)
      .run(`${MEDIA}accounts/ana-personal/products/chest.jpg`);
    db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order)
      VALUES ('m1', 'ana-personal', 'ana-table', 'chest-1', 'Old Shou', 1)`).run();
  });

  it('names a private chest tea without its id, photograph or account', async () => {
    const list = await (await call(`/api/events/${slugOf('ana-table')}/tea-menu`)).json() as any[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ product_id: null, product_image_url: null, product_name: 'Old Shou' });
    const page = await (await call('/api/rsvp/token-mei')).text();
    expect(page).not.toContain('chest-1');
    expect(page).not.toContain('chest.jpg');
    expect(page).not.toContain('"account_id"');
    expect(page).not.toContain('ana-personal"');
  });

  it('shows the chest tea’s id once the account is public', async () => {
    db.sqlite.prepare(`UPDATE accounts SET public_enabled = 1 WHERE id = 'ana-personal'`).run();
    const list = await (await call(`/api/events/${slugOf('ana-table')}/tea-menu`)).json() as any[];
    expect(list[0]).toMatchObject({ product_id: 'chest-1', product_image_url: `${MEDIA}accounts/ana-personal/products/chest.jpg` });
  });

  it('leaves the venue id out of the public answer, and the session id for a private host only', async () => {
    const answer = await (await call(`/api/events/${slugOf('ana-table')}/public`)).json() as Record<string, unknown>;
    expect(answer).not.toHaveProperty('venue_id');
    expect(answer).not.toHaveProperty('id');
    expect(answer.slug).toBe(slugOf('ana-table'));
    table('shop-night', adrian.accountId);
    db.sqlite.prepare(`UPDATE events SET public_visibility = 'public' WHERE id = 'shop-night'`).run();
    const shop = await (await call(`/api/events/${slugOf('shop-night')}/public`)).json() as Record<string, unknown>;
    expect(shop.id).toBe('shop-night');
    expect(shop).not.toHaveProperty('venue_id');
  });
});

describe('F5: a stopped host leaves what is already recorded open to the guest', () => {
  for (const mode of ['withdrawn', 'closed'] as const) {
    it(`keeps the guest’s own page, its edit and the thank-you link when the host is ${mode}`, async () => {
      table('ana-table', ana.accountId, { hostUserId: 'ana', lifecycle: 'completed', date: at(-DAY) });
      guest('mei', 'ana-table', ana.accountId, 'confirmed');
      db.sqlite.prepare(`UPDATE event_attendees SET attended = 1 WHERE id = 'mei'`).run();
      const link = await issueAfterSitLink(db as unknown as D1Database, { attendeeId: 'mei', eventId: 'ana-table', accountId: ana.accountId });
      expect(link).not.toBeNull();

      if (mode === 'withdrawn') expect((await withdraw()).status).toBe(200);
      const open = mode === 'closed' ? false : true;
      expect((await call(`/api/events/${slugOf('ana-table')}/public`, { open })).status).toBe(404);

      const page = await call('/api/rsvp/token-mei', { open });
      expect(page.status).toBe(200);
      const body = await page.json() as any;
      expect(body.event.address_text).toBeNull();
      expect(body.event.venue_guide).toBeNull();
      expect((await call('/api/rsvp/token-mei', { open, method: 'PUT', body: { notes: 'Thank you' } })).status).toBe(200);
      const recap = await call('/api/after-sit/recap', { open, method: 'POST', body: { credential: link!.credential } });
      expect(recap.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, notes FROM event_attendees WHERE id = 'mei'`).get()).toEqual({ status: 'confirmed', notes: 'Thank you' });
    });
  }
});

describe('F6: no door seats anyone once the session has ended', () => {
  it('refuses a by-link seat, a by-request seat, an offer and a host yes after the end', async () => {
    table('late-link', ana.accountId, { hostUserId: 'ana', door: 'link', date: at(-10 * HOUR) });
    const seat = await call(`/api/events/${slugOf('late-link')}/rsvp`, { method: 'POST', body: { full_name: 'Mei' } });
    expect(seat.status).toBe(409);
    table('late-request', ana.accountId, { hostUserId: 'ana', date: at(-10 * HOUR) });
    expect((await call(`/api/events/${slugOf('late-request')}/rsvp`, { method: 'POST', body: { full_name: 'Mei', phone_number: '+62 811 222 333' } })).status).toBe(409);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees`).get()).toEqual({ n: 0 });

    guest('asked', 'late-request', ana.accountId, 'requested');
    expect((await call('/api/me/tables/late-request/guests/asked/yes', { actor: ana, method: 'PUT', body: {} })).status).toBe(409);
    guest('offered', 'late-request', ana.accountId, 'waitlist');
    db.sqlite.prepare(`UPDATE event_attendees SET claim_expires_at = ? WHERE id = 'offered'`).run(new Date(Date.now() + HOUR).toISOString());
    expect((await call('/api/rsvp/token-offered/claim', { method: 'POST' })).status).not.toBe(200);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees WHERE status = 'confirmed'`).get()).toEqual({ n: 0 });

    // Before the end the same door seats at once.
    table('open-link', ana.accountId, { hostUserId: 'ana', door: 'link', date: at(-1 * HOUR) });
    expect((await call(`/api/events/${slugOf('open-link')}/rsvp`, { method: 'POST', body: { full_name: 'Mei' } })).status).toBe(201);
  });
});

describe('F8: one rule for who hosts a session', () => {
  function contributor(id: string, name: string, userId: string) {
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published) VALUES (?, 'shop', ?, ?, 1)`).run(id, name, userId);
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES (?, 'shop')`).run(id);
  }
  const hostOf = (id: string) => (db.sqlite.prepare(`SELECT ${sessionHostUserSql('e')} AS host FROM events e WHERE e.id = ?`).get(id) as { host: string | null }).host;
  const holds = async (userId: string, id: string) =>
    (await guestLinkSessions(db as unknown as D1Database, { userId, accountId: 'shop', isOwner: false }, [id])).has(id);
  const hostedBy = async (id: string) => ((await (await call(`/api/events/${slugOf(id)}/public`)).json()) as any).host;

  beforeEach(() => {
    seedIdentity(db, { userId: 'lee', accountId: 'lee-unused' });
    contributor('lee-page', 'Lee', 'lee');
  });

  it('names host_user_id first, for the credit, the guest links and Hosted by alike', async () => {
    table('shop-night', adrian.accountId, { hostUserId: 'ana' });
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES ('ec', 'shop', 'shop-night', 'lee-page', 'lead_host', 1)`).run();
    expect(hostOf('shop-night')).toBe('ana');
    expect(await holds('lee', 'shop-night')).toBe(false);
    expect((await hostedBy('shop-night')).name).toBe('Ana');
  });

  it('falls back to the lead host the public page names, and to nobody for a lead host it does not', async () => {
    table('shop-night', adrian.accountId);
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES ('ec', 'shop', 'shop-night', 'lee-page', 'lead_host', 1)`).run();
    expect(hostOf('shop-night')).toBe('lee');
    expect(await holds('lee', 'shop-night')).toBe(true);
    expect(await hostedBy('shop-night')).toEqual({ name: 'Lee', path: '/people/lee-page' });

    db.sqlite.prepare(`UPDATE event_contributors SET is_public = 0 WHERE id = 'ec'`).run();
    expect(hostOf('shop-night')).toBeNull();
    expect(await holds('lee', 'shop-night')).toBe(false);
    expect(await hostedBy('shop-night')).toBeNull();

    db.sqlite.prepare(`UPDATE event_contributors SET is_public = 1 WHERE id = 'ec'`).run();
    db.sqlite.prepare(`UPDATE contributors SET is_published = 0, unpublished_at = '2026-11-26' WHERE id = 'lee-page'`).run();
    expect(hostOf('shop-night')).toBeNull();
    expect(await hostedBy('shop-night')).toBeNull();
  });
});

describe('F9: tea search lists only the shop teas the browse list shows', () => {
  it('leaves out a sold-out shop tea, and keeps the host’s own chest', async () => {
    table('ana-table', ana.accountId, { hostUserId: 'ana' });
    const product = (id: string, accountId: string, stock: number) => db.sqlite.prepare(`INSERT INTO products
        (id, account_id, product_name, given_name, type, status, is_public, shown_in_shop, stock_grams, cost_amount, cost_currency)
      VALUES (?, ?, ?, ?, 'Shou', 'Active', 1, 1, ?, 10, 'Yuan')`).run(id, accountId, `Shou ${id}`, `Shou ${id}`, stock);
    product('shop-ok', adrian.accountId, 200);
    product('shop-empty', adrian.accountId, 0);
    product('ana-chest', ana.accountId, 0);
    const found = await (await call('/api/me/tables/ana-table/tea-search?q=shou', { actor: ana })).json() as { matches: { id: string }[] };
    expect(found.matches.map(match => match.id).sort()).toEqual(['ana-chest', 'shop-ok']);
  });
});

describe('a host’s tea photographs', () => {
  it('are served private and short-lived, like the way in', async () => {
    const response = await call('/api/media/accounts/ana-personal/host-teas/ana-table/tea.jpg');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
  });
});
