// A3: the privacy review of a stranger's table (Launch 3, anyone can host).
// The findings are in guests-build/a3-launch-3-privacy-review.md; one describe
// per fix the worker holds.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-a3-privacy-secret';
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana', accountId: 'ana-home' };
const mei: Actor = { userId: 'mei', name: 'Mei Lin', accountId: 'mei-home' };
const lu: Actor = { userId: 'lu', name: 'Lu Wen', accountId: 'lu-home' };
const sly: Actor = { userId: 'sly', name: 'Sly', accountId: 'sly-home' };

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; anyone?: boolean; account?: string } = {}) {
  const { actor, body, method = 'GET', anyone = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.33' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: options.account ?? actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', options.account ?? actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: anyone ? 'true' : 'false',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
  } as never, { waitUntil: () => undefined } as never);
}

const json = async (response: Response) => response.json() as Promise<Record<string, any>>;
const day = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

async function makeTable(actor: Actor, seats: number, door: 'request' | 'link' = 'request') {
  const made = await call('/api/me/tables', { actor, method: 'POST', body: { date: day, time: '16:00', timezone: 'Asia/Makassar', seats, door } });
  expect(made.status).toBe(201);
  const table = await json(made) as { id: string; slug: string };
  const { account_id } = db.sqlite.prepare('SELECT account_id FROM events WHERE id = ?').get(table.id) as { account_id: string };
  return { ...table, accountId: account_id };
}

let phone = 100;
async function ask(slug: string, name: string, phoneNumber?: string) {
  phone += 1;
  const asked = await call(`/api/events/${slug}/rsvp`, {
    method: 'POST', body: { full_name: name, phone_number: phoneNumber ?? `+62 811 7770${phone}`, email: `${name.split(' ')[0].toLowerCase()}@guest.test` },
  });
  expect(asked.status).toBe(201);
  const body = await json(asked);
  const row = db.sqlite.prepare('SELECT id FROM event_attendees WHERE magic_token = ?').get(body.magic_token) as { id: string };
  return { status: body.status as string, token: body.magic_token as string, id: row.id };
}

const yes = (tableId: string, id: string) => call(`/api/me/tables/${tableId}/guests/${id}/yes`, { actor: ana, method: 'PUT', body: {} });
const no = (tableId: string, id: string) => call(`/api/me/tables/${tableId}/guests/${id}/no`, { actor: ana, method: 'PUT', body: {} });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(adrian.accountId);
  for (const person of [ana, mei, lu, sly]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
  db.sqlite.prepare("UPDATE users SET name = 'Mei Lin' WHERE id = 'mei'").run();
  db.sqlite.prepare("UPDATE users SET name = 'Lu Wen', username = 'luwen' WHERE id = 'lu'").run();
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('A3: with ANYONE_HOSTS_OPEN off, every Launch 3 door is closed', () => {
  it('closes the tasting join, the gallery, release, seat notices and the Launch 3 fields', async () => {
    const table = await makeTable(ana, 4);
    const guest = await ask(table.slug, 'Mei Lin');
    expect((await yes(table.id, guest.id)).status).toBe(200);
    db.sqlite.prepare("UPDATE events SET is_tasting = 1, contribution_kind = 'free', contribution_note = 'Bring a cup' WHERE id = ?").run(table.id);
    db.sqlite.prepare("UPDATE event_attendees SET user_id = 'mei' WHERE id = ?").run(guest.id);
    const off = { anyone: false };

    expect((await call(`/api/rsvp/${guest.token}/tasting`, { ...off, actor: mei, method: 'POST', body: {} })).status).toBe(404);
    expect((await json(await call(`/api/rsvp/${guest.token}`, off))).event.is_tasting).toBe(false);
    expect((await call('/api/after-sit/gallery', { ...off, actor: mei, method: 'POST', body: { credential: 'x', action: 'read' } })).status).toBe(404);
    expect((await call(`/api/me/tables/${table.id}/guests/${guest.id}/release`, { ...off, actor: ana, method: 'PUT', body: {} })).status).toBe(404);
    expect(db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(guest.id)).toEqual({ status: 'confirmed' });
    expect((await call(`/api/admin/events/${table.id}/seat-notices`, { ...off, actor: ana, account: table.accountId })).status).toBe(404);
    expect(await json(await call(`/api/me/tables/${table.id}`, { ...off, actor: ana }))).not.toHaveProperty('notices');

    const page = await json(await call(`/api/events/${table.slug}/public`, off));
    for (const field of ['is_tasting', 'contribution_kind', 'contribution_note']) expect(page).not.toHaveProperty(field);

    // The shop's form may still send them; nothing is written while closed.
    db.sqlite.prepare("UPDATE events SET is_tasting = 0, contribution_kind = NULL, contribution_note = NULL WHERE id = ?").run(table.id);
    const saved = await call(`/api/admin/events/${table.id}`, {
      ...off, actor: ana, account: table.accountId, method: 'PUT',
      body: { title: 'Tea at Ana’s', is_tasting: true, contribution_kind: 'price', contribution_note: 'Ten' },
    });
    expect(saved.status).toBe(200);
    expect(db.sqlite.prepare('SELECT title, is_tasting, contribution_kind, contribution_note FROM events WHERE id = ?').get(table.id))
      .toEqual({ title: 'Tea at Ana’s', is_tasting: 0, contribution_kind: null, contribution_note: null });
  });

  it('opens the same doors with the switch on', async () => {
    const table = await makeTable(ana, 4);
    const guest = await ask(table.slug, 'Mei Lin');
    await yes(table.id, guest.id);
    db.sqlite.prepare("UPDATE events SET is_tasting = 1, contribution_kind = 'free' WHERE id = ?").run(table.id);
    expect((await json(await call(`/api/rsvp/${guest.token}`))).event.is_tasting).toBe(true);
    expect(await json(await call(`/api/events/${table.slug}/public`))).toMatchObject({ is_tasting: true, contribution_kind: 'free' });
    expect((await call(`/api/admin/events/${table.id}/seat-notices`, { actor: ana, account: table.accountId })).status).toBe(200);
    expect((await call(`/api/me/tables/${table.id}/guests/${guest.id}/release`, { actor: ana, method: 'PUT', body: {} })).status).toBe(200);
  });
});

describe('A3: a table’s tasting is the table’s', () => {
  async function tasting() {
    const table = await makeTable(ana, 4);
    const first = await ask(table.slug, 'Mei Lin');
    const second = await ask(table.slug, 'Lu Wen');
    for (const guest of [first, second]) expect((await yes(table.id, guest.id)).status).toBe(200);
    db.sqlite.prepare("UPDATE event_attendees SET user_id = 'mei' WHERE id = ?").run(first.id);
    db.sqlite.prepare("UPDATE event_attendees SET user_id = 'lu' WHERE id = ?").run(second.id);
    expect((await call(`/api/me/tables/${table.id}/tasting`, { actor: ana, method: 'PUT', body: { is_tasting: true } })).status).toBe(200);
    const joined = await call(`/api/rsvp/${first.token}/tasting`, { actor: mei, method: 'POST', body: {} });
    expect(joined.status).toBe(200);
    const { session_id: sessionId } = await json(joined);
    expect((await call(`/api/rsvp/${second.token}/tasting`, { actor: lu, method: 'POST', body: {} })).status).toBe(200);
    return { table, first, second, sessionId: sessionId as string };
  }

  it('is never joined by its id alone, so a stranger who works the id out reads nothing', async () => {
    const { table, sessionId } = await tasting();
    expect(sessionId).toBe(`event-tasting-${table.id}`);
    expect((await call(`/api/sessions/${sessionId}/join`, { actor: sly, method: 'POST', body: {} })).status).toBe(404);
    expect((await call(`/api/sessions/${sessionId}`, { actor: sly })).status).toBe(403);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tasting_session_members WHERE session_id = ? AND user_id = ?').get(sessionId, 'sly'))
      .toEqual({ n: 0 });
  });

  it('shows guests one another by first name, with no username, account id or invitation', async () => {
    const { sessionId } = await tasting();
    const answer = await call(`/api/sessions/${sessionId}`, { actor: mei });
    expect(answer.status).toBe(200);
    const text = await answer.text();
    const body = JSON.parse(text);
    expect(body.session).not.toHaveProperty('invite_token');
    expect(text).not.toContain('luwen');
    const names = (body.members as { name: string | null; user_id: string | null }[]);
    expect(names.map(member => member.name)).toEqual(expect.arrayContaining(['Mei', 'Lu']));
    expect(text).not.toContain('Lu Wen');
    expect(names.find(member => member.name === 'Lu')?.user_id).toBeNull();
    expect(names.find(member => member.name === 'Mei')?.user_id).toBe('mei');
  });

  it('closes to a guest once their seat is given back', async () => {
    const { table, first, sessionId } = await tasting();
    expect((await call(`/api/sessions/${sessionId}`, { actor: mei })).status).toBe(200);
    expect((await call(`/api/me/tables/${table.id}/guests/${first.id}/release`, { actor: ana, method: 'PUT', body: {} })).status).toBe(200);
    expect((await call(`/api/sessions/${sessionId}`, { actor: mei })).status).toBe(403);
    expect((await call(`/api/sessions/${sessionId}/verdicts`, { actor: mei })).status).toBe(403);
    // The other guest still reads it.
    expect((await call(`/api/sessions/${sessionId}`, { actor: lu })).status).toBe(200);
  });
});

describe('A3: a host’s admin lists read only their own account', () => {
  function shopHistory(phoneNumber: string) {
    db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, status, lifecycle_status)
      VALUES ('shop-past', 'shop', 'shop-past', 'Adrian’s session', '2026-01-01T10:00:00.000Z', 8, 'UTC', 'active', 'completed')`).run();
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, email, status, attended, magic_token)
      VALUES ('shop-guest', 'shop', 'shop-past', 'Secret Regular', ?, 'regular@guest.test', 'confirmed', 1, 'shop-guest-token')`).run(phoneNumber);
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags) VALUES ('shop-customer', 'shop', 'Secret Buyer', '["vip"]')`).run();
  }

  it('counts a phone’s sittings in the host’s own account only, and carries no guest link or email', async () => {
    const watched = '+62 811 000 999';
    shopHistory(watched);
    const table = await makeTable(ana, 4);
    const guest = await ask(table.slug, 'Probe Person', watched);

    for (const path of [`/api/admin/events/${table.id}/attendees`, '/api/admin/pending-attendees']) {
      const answer = await call(path, { actor: ana, account: table.accountId });
      expect(answer.status).toBe(200);
      const text = await answer.text();
      const rows = JSON.parse(text) as Record<string, any>[];
      const row = rows.find(entry => entry.id === guest.id)!;
      expect(row).toBeTruthy();
      const journey = 'journey_preview' in row ? row.journey_preview : row;
      expect(journey.sessions_attended).toBe(0);
      expect(journey.last_attended).toBeNull();
      for (const field of ['magic_token', 'email', 'user_id']) expect(row).not.toHaveProperty(field);
      expect(text).not.toContain(guest.token);
      expect(text).not.toContain('2026-01-01');
    }
  });

  it('keeps a shop’s own journey and guest links as before', async () => {
    shopHistory('+62 811 222 333');
    db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, status, lifecycle_status)
      VALUES ('shop-next', 'shop', 'shop-next', 'Next', ?, 8, 'UTC', 'active', 'published')`).run(`${day}T10:00:00.000Z`);
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, status, magic_token)
      VALUES ('shop-again', 'shop', 'shop-next', 'Secret Regular', '+62 811 222 333', 'requested', 'shop-again-token')`).run();
    const rows = await json(await call('/api/admin/events/shop-next/attendees', { actor: adrian })) as unknown as Record<string, any>[];
    expect(rows[0]).toMatchObject({ magic_token: 'shop-again-token', journey_preview: { sessions_attended: 1 } });
  });

  it('links a guest only to a customer of the same account, and never reads another account’s customer', async () => {
    shopHistory('+62 811 444 555');
    const table = await makeTable(ana, 4);
    const guest = await ask(table.slug, 'Mei Lin');
    const linked = await call(`/api/admin/attendees/${guest.id}`, { actor: ana, account: table.accountId, method: 'PUT', body: { customer_id: 'shop-customer' } });
    expect(linked.status).toBe(404);
    db.sqlite.prepare(`UPDATE event_attendees SET customer_id = 'shop-customer' WHERE id = ?`).run(guest.id);
    const text = await (await call(`/api/admin/events/${table.id}/attendees`, { actor: ana, account: table.accountId })).text();
    expect(text).not.toContain('Secret Buyer');
    expect(text).not.toContain('vip');
  });
});

describe('A3: the reach lists carry no id for a person’s table', () => {
  it('lists a shop session with its id and nothing else changes', async () => {
    db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
        public_visibility, network_discovery, status, lifecycle_status)
      VALUES ('shop-1', 'shop', 'shop-1', 'Shop', ?, 6, 'UTC', 'public', 1, 'active', 'published')`).run(`${day}T10:00:00.000Z`);
    const rows = await json(await call('/api/events')) as unknown as Record<string, unknown>[];
    expect(rows).toEqual([expect.objectContaining({ id: 'shop-1', slug: 'shop-1' })]);
    expect(rows[0]).not.toHaveProperty('private_host');
  });
});

describe('A3: a host keeps a guest’s phone only while that guest is coming or asking', () => {
  it('drops the phone of a guest said no to, and of a guest whose seat was given back', async () => {
    const table = await makeTable(ana, 4);
    const asking = await ask(table.slug, 'Ari Ask', '+62 811 100 001');
    const refused = await ask(table.slug, 'Bo No', '+62 811 100 002');
    const coming = await ask(table.slug, 'Cy Comes', '+62 811 100 003');
    expect((await no(table.id, refused.id)).status).toBe(200);
    expect((await yes(table.id, coming.id)).status).toBe(200);
    const phones = async () => Object.fromEntries(((await json(await call(`/api/me/tables/${table.id}`, { actor: ana }))).guests as { id: string; phone: string | null }[])
      .map(guest => [guest.id, guest.phone]));
    expect(await phones()).toEqual({ [asking.id]: '+62 811 100 001', [refused.id]: null, [coming.id]: '+62 811 100 003' });
    await call(`/api/rsvp/${coming.token}`, { method: 'PUT', body: { cancel: true } });
    expect((await phones())[coming.id]).toBeNull();
  });
});

describe('A3: a stopped host’s table offers no seat', () => {
  it('offers a freed seat to nobody while the host is stopped', async () => {
    expect((await call('/api/platform/users/ana/host-approval', { actor: adrian, method: 'PUT', body: { approved: true } })).status).toBe(200);
    const table = await makeTable(ana, 1, 'link');
    const seated = await ask(table.slug, 'Ari');
    expect(seated.status).toBe('confirmed');
    // A guest already on the waiting list, as the shop's Manage puts one there.
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, waitlist_position, magic_token)
      VALUES ('bo-waits', ?, ?, 'Bo Waits', 'waitlist', 1, 'bo-waits-token')`).run(table.accountId, table.id);
    const waiting = { id: 'bo-waits' };
    expect((await call('/api/platform/users/ana/hosting-stopped', { actor: adrian, method: 'PUT', body: { stopped: true } })).status).toBe(200);
    expect((await call(`/api/rsvp/${seated.token}`, { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status, claim_expires_at FROM event_attendees WHERE id = ?').get(waiting.id))
      .toEqual({ status: 'waitlist', claim_expires_at: null });
    // Hosting again, the next change moves the list on as before.
    expect((await call('/api/platform/users/ana/hosting-stopped', { actor: adrian, method: 'PUT', body: { stopped: false } })).status).toBe(200);
    expect((await call(`/api/me/tables/${table.id}`, { actor: ana, method: 'PUT', body: { seats: 1 } })).status).toBe(200);
    expect((db.sqlite.prepare('SELECT claim_expires_at FROM event_attendees WHERE id = ?').get(waiting.id) as { claim_expires_at: string | null })
      .claim_expires_at).not.toBeNull();
  });
});
