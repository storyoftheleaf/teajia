// Launch 2, slice H8 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Sol, H8"): the way to the house from the host's side. Only the table's
// host reads or saves its way, keeps it as a place for next time, and uploads
// its photographs, which land under venue-guide/ in the host's own account.
// A step photograph from anywhere else is refused. Who receives the way is
// unchanged: a confirmed guest, until the session ends.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { isOwnWayPhoto } from '../src/hostTableWay';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-way-secret';
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'platform-home' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };
const photo = (n: number, account = ana.accountId) => `https://media.teajia.co/accounts/${account}/venue-guide/step-${n}.jpg`;

let db: SqliteD1;
let stored: string[];

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; form?: FormData } = {}) {
  const { actor, body, form, method = 'GET' } = options;
  const headers = new Headers();
  if (!form) headers.set('Content-Type', 'application/json');
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true',
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
    MEDIA_BUCKET: { put: async (key: string) => { stored.push(key); } },
  } as never);
}

function personalAccount(userId: string) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(id, id, id, userId, userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null, when = new Date(Date.now() + 7 * 86400000).toISOString()) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status)
    VALUES (?, ?, ?, ?, ?, 4, 'Asia/Makassar', 'request', 1, 'unlisted', 0, ?, 'active', 'published')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, when, hostUserId);
}

function guest(id: string, eventId: string, accountId: string, status: string) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `magic-${id}`, status);
}

const threeSteps = {
  address: 'Jalan Raya Ubud 12',
  map_link: 'https://maps.example.test/?q=ubud',
  venue_guide: {
    steps: [
      { description: 'The blue gate after the warung.', image_url: photo(1) },
      { description: 'Through the garden, left at the frangipani.', image_url: photo(2) },
      { description: 'Shoes off at the step.', image_url: photo(3) },
    ],
    parking_notes: 'Scooters by the wall.',
    arrival_notes: 'Something warm for the evening.',
    lost_phone: '+62 812 0000 0009',
  },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  stored = [];
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather', 'sell'] });
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-home`, publicEnabled: false });
    personalAccount(person.userId);
  }
  table('t-ana', ana.accountId, ana.userId);
  table('t-ana-2', ana.accountId, ana.userId);
  table('t-bo', bo.accountId, bo.userId);
  table('t-shop', adrian.accountId, null);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('the host saves the way in', () => {
  it('saves three steps, the address and the three lines, and reads them back', async () => {
    const saved = await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: threeSteps });
    expect(saved.status).toBe(200);
    expect(saved.headers.get('Cache-Control')).toBe('private, no-store');
    const read = await (await call('/api/me/tables/t-ana/way', { actor: ana })).json() as Record<string, any>;
    expect(read.way).toEqual({ ...threeSteps, place_id: null });
    const row = db.sqlite.prepare('SELECT address_text, map_link, venue_guide FROM events WHERE id = ?').get('t-ana') as Record<string, string>;
    expect(row.address_text).toBe('Jalan Raya Ubud 12');
    expect(JSON.parse(row.venue_guide).steps).toHaveLength(3);
  });

  it('clears the way when every part is left empty, and leaves out a step with nothing in it', async () => {
    await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: threeSteps });
    const partial = await call('/api/me/tables/t-ana/way', {
      actor: ana, method: 'PUT', body: { venue_guide: { steps: [{ description: '  ' }, { description: 'Only words.' }] } },
    });
    expect(((await partial.json()) as any).way.venue_guide).toEqual({ steps: [{ description: 'Only words.' }] });
    const cleared = await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: { venue_guide: { steps: [] } } });
    expect(((await cleared.json()) as any).way).toEqual({ address: null, map_link: null, venue_guide: null, place_id: null });
  });

  it('refuses a photograph that was not uploaded for this account’s way in, and a map link that is not https', async () => {
    for (const image_url of [photo(1, bo.accountId), 'https://tracker.example.test/pixel.gif', 'https://media.teajia.co/accounts/ana-personal/flyers/x.jpg']) {
      const response = await call('/api/me/tables/t-ana/way', {
        actor: ana, method: 'PUT', body: { venue_guide: { steps: [{ description: 'Gate', image_url }] } },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'table_way_photo' });
    }
    const link = await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: { map_link: 'javascript:alert(1)' } });
    expect(link.status).toBe(400);
    const tooMany = await call('/api/me/tables/t-ana/way', {
      actor: ana, method: 'PUT', body: { venue_guide: { steps: Array.from({ length: 21 }, () => ({ description: 'x' })) } },
    });
    expect(tooMany.status).toBe(400);
  });

  it('answers 404 to another host, to the shop owner, and for a shop’s session', async () => {
    for (const actor of [bo, adrian]) {
      expect((await call('/api/me/tables/t-ana/way', { actor })).status).toBe(404);
      expect((await call('/api/me/tables/t-ana/way', { actor, method: 'PUT', body: threeSteps })).status).toBe(404);
      expect((await call('/api/me/tables/t-ana/way/keep', { actor, method: 'POST', body: { name: 'Ubud' } })).status).toBe(404);
    }
    expect((await call('/api/me/tables/t-shop/way', { actor: ana })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/way')).status).toBe(401);
    const row = db.sqlite.prepare('SELECT venue_guide FROM events WHERE id = ?').get('t-ana') as Record<string, unknown>;
    expect(row.venue_guide).toBeNull();
  });
});

describe('keeping the way for next time', () => {
  it('keeps the table’s way as a place by name, lists it for the next table, and updates it under the same name', async () => {
    expect((await call('/api/me/tables/t-ana/way/keep', { actor: ana, method: 'POST', body: { name: 'Ubud house' } })).status).toBe(409);
    await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: threeSteps });
    const kept = await call('/api/me/tables/t-ana/way/keep', { actor: ana, method: 'POST', body: { name: 'Ubud house' } });
    expect(kept.status).toBe(200);
    const place = ((await kept.json()) as any).place;
    expect(place).toMatchObject({ name: 'Ubud house', address: 'Jalan Raya Ubud 12' });
    expect(place.venue_guide.steps).toHaveLength(3);

    const next = await (await call('/api/me/tables/t-ana-2/way', { actor: ana })).json() as Record<string, any>;
    expect(next.way.venue_guide).toBeNull();
    expect(next.places).toEqual([expect.objectContaining({ id: place.id, name: 'Ubud house' })]);
    expect((await (await call('/api/me/tables/t-ana/way', { actor: ana })).json() as any).way.place_id).toBe(place.id);

    // Bo never sees Ana's places.
    expect(((await (await call('/api/me/tables/t-bo/way', { actor: bo })).json()) as any).places).toEqual([]);

    await call('/api/me/tables/t-ana/way', {
      actor: ana, method: 'PUT', body: { ...threeSteps, venue_guide: { steps: [threeSteps.venue_guide.steps[0]] } },
    });
    await call('/api/me/tables/t-ana/way/keep', { actor: ana, method: 'POST', body: { name: 'ubud HOUSE' } });
    const rows = db.sqlite.prepare('SELECT id, venue_guide FROM saved_locations WHERE account_id = ?').all(ana.accountId) as Array<Record<string, string>>;
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].venue_guide).steps).toHaveLength(1);
  });
});

describe('the photographs of the way in', () => {
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], 'step.jpg', { type: 'image/jpeg' });

  it('stores the host’s photograph under venue-guide/ in their own account', async () => {
    const form = new FormData();
    form.append('file', jpeg());
    const response = await call('/api/me/tables/t-ana/way/photos', { actor: ana, method: 'POST', form });
    expect(response.status).toBe(201);
    const { url, key } = await response.json() as { url: string; key: string };
    expect(key).toMatch(/^accounts\/ana-personal\/venue-guide\/[0-9a-f-]+\.jpg$/);
    expect(stored).toEqual([key]);
    expect(isOwnWayPhoto(url, ana.accountId)).toBe(true);
  });

  it('refuses another host and anything that is not a photograph', async () => {
    const form = new FormData();
    form.append('file', jpeg());
    expect((await call('/api/me/tables/t-ana/way/photos', { actor: bo, method: 'POST', form })).status).toBe(404);
    const text = new FormData();
    text.append('file', new File(['hello'], 'note.txt', { type: 'text/plain' }));
    expect((await call('/api/me/tables/t-ana/way/photos', { actor: ana, method: 'POST', form: text })).status).toBe(415);
    expect(stored).toEqual([]);
  });
});

describe('who receives the way is unchanged', () => {
  it('gives the saved way to a confirmed guest and never to one still waiting', async () => {
    await call('/api/me/tables/t-ana/way', { actor: ana, method: 'PUT', body: threeSteps });
    guest('g-yes', 't-ana', ana.accountId, 'confirmed');
    guest('g-wait', 't-ana', ana.accountId, 'requested');
    const yes = await (await call('/api/rsvp/magic-g-yes')).json() as Record<string, any>;
    expect(JSON.parse(yes.event.venue_guide).steps).toHaveLength(3);
    expect(yes.event.address_text).toBe('Jalan Raya Ubud 12');
    const waiting = await (await call('/api/rsvp/magic-g-wait')).json() as Record<string, any>;
    expect(waiting.event.venue_guide).toBeNull();
    expect(waiting.event.address_text).toBeNull();
  });
});
