// Launch 2, slice H9 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Sol, H9"): the host's private guest book. A note is the table's host's
// alone: not another host's, not a co-host's, not the shop owner's, never on
// the guest's own page, and read or written by no worker file but one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { clearGuestNote, guestNotesFor, saveGuestNote } from '../src/hostGuestNotes';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-notes-secret';
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'platform-home' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };

let db: SqliteD1;
const d1 = () => db as unknown as D1Database;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown } = {}) {
  const { actor, body, method = 'GET' } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true' } as never);
}

function personalAccount(userId: string) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(id, id, id, userId, userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function finishedTable(id: string, accountId: string, hostUserId: string | null) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status)
    VALUES (?, ?, ?, ?, '2026-11-20T08:00:00.000Z', 6, 'Asia/Makassar', 'link', 0, 'unlisted', 0, ?, 'closed', 'completed')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, hostUserId);
}

function cameGuest(id: string, eventId: string, accountId: string) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status, attended)
    VALUES (?, ?, ?, ?, ?, 'confirmed', 1)`).run(id, accountId, eventId, `Guest ${id}`, `magic-${id}`);
}

const scope = { hostUserId: 'ana', accountId: 'ana-personal', eventId: 't-ana' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather'] });
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-home`, publicEnabled: false });
    personalAccount(person.userId);
  }
  finishedTable('t-ana', ana.accountId, ana.userId);
  cameGuest('g-rui', 't-ana', ana.accountId);
  cameGuest('g-lin', 't-ana', ana.accountId);
  finishedTable('t-bo', bo.accountId, bo.userId);
  cameGuest('g-bo', 't-bo', bo.accountId);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('the module', () => {
  it('saves, changes and clears a host’s line about one guest', async () => {
    expect(await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: '  Likes it strong.  ' }))
      .toMatchObject({ ok: true, note: { attendee_id: 'g-rui', note: 'Likes it strong.' } });
    expect(await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: 'Brought a cake.' })).toMatchObject({ ok: true });
    expect(await guestNotesFor(d1(), scope)).toEqual({ notes: [expect.objectContaining({ attendee_id: 'g-rui', note: 'Brought a cake.' })] });
    expect(await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: '' })).toEqual({ ok: true, note: null });
    expect(await guestNotesFor(d1(), scope)).toEqual({ notes: [] });
    await saveGuestNote(d1(), { ...scope, attendeeId: 'g-lin', note: 'Quiet.' });
    expect(await clearGuestNote(d1(), { ...scope, attendeeId: 'g-lin' })).toEqual({ ok: true, note: null });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM host_guest_notes').get()).toEqual({ n: 0 });
  });

  it('refuses a 501 character note and keeps 500', async () => {
    expect(await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: 'x'.repeat(501) }))
      .toEqual({ refused: { code: 'guest_note_too_long', error: 'Keep the note to 500 characters.' } });
    expect(await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: 'x'.repeat(500) })).toMatchObject({ ok: true });
  });

  it('gives the same not found for another host, another account, and a guest of another session', async () => {
    const cases = [
      { ...scope, hostUserId: 'bo', attendeeId: 'g-rui' },
      { ...scope, accountId: 'bo-personal', attendeeId: 'g-rui' },
      { ...scope, attendeeId: 'g-bo' },
      { ...scope, eventId: 't-bo', attendeeId: 'g-bo' },
    ];
    for (const attempt of cases) {
      expect(await saveGuestNote(d1(), { ...attempt, note: 'x' })).toEqual({ notFound: true });
      expect(await clearGuestNote(d1(), attempt)).toEqual({ notFound: true });
    }
    expect(await guestNotesFor(d1(), { ...scope, hostUserId: 'bo' })).toEqual({ notFound: true });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM host_guest_notes').get()).toEqual({ n: 0 });
  });
});

describe('the routes', () => {
  it('let the host write and read their own notes, and nobody else', async () => {
    const put = await call('/api/me/tables/t-ana/guests/g-rui/note', { actor: ana, method: 'PUT', body: { note: 'Likes it strong.' } });
    expect(put.status).toBe(200);
    expect(put.headers.get('Cache-Control')).toBe('private, no-store');
    const read = await call('/api/me/tables/t-ana/notes', { actor: ana });
    expect(await read.json()).toEqual({ notes: [expect.objectContaining({ attendee_id: 'g-rui', note: 'Likes it strong.' })] });

    // Another host, and the shop owner, reach nothing.
    for (const actor of [bo, adrian]) {
      expect((await call('/api/me/tables/t-ana/notes', { actor })).status).toBe(404);
      expect((await call('/api/me/tables/t-ana/guests/g-rui/note', { actor, method: 'PUT', body: { note: 'Mine now' } })).status).toBe(404);
    }
    expect((await call('/api/me/tables/t-ana/notes')).status).toBe(401);
    // A guest id from another session, through the host's own table.
    expect((await call('/api/me/tables/t-ana/guests/g-bo/note', { actor: ana, method: 'PUT', body: { note: 'x' } })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/guests/g-rui/note', { actor: ana, method: 'PUT', body: { note: 'x'.repeat(501) } })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT note FROM host_guest_notes').all()).toEqual([{ note: 'Likes it strong.' }]);
  });

  it('keeps a co-host of the same session out, even one who is a member of the host’s account', async () => {
    await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: 'Likes it strong.' });
    db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES ('ana-personal', 'bo', 'staff', 'active')`).run();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name) VALUES ('c-bo', 'ana-personal', 'bo', 'Bo')`).run();
    db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id, is_host) VALUES ('c-bo', 'ana-personal', 1)`).run();
    db.sqlite.prepare(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role) VALUES ('ec-bo', 'ana-personal', 't-ana', 'c-bo', 'co_host')`).run();
    const coHost = { userId: 'bo', accountId: 'ana-personal' };
    expect((await call('/api/me/tables/t-ana/notes', { actor: coHost })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana', { actor: coHost })).status).toBe(404);
    // The shop's own guest list for the session carries no note either.
    const shopList = await call('/api/admin/events/t-ana/attendees', { actor: coHost });
    expect(await shopList.text()).not.toContain('Likes it strong.');
  });

  it('never shows the note on the host’s table answer or the guest’s own page', async () => {
    await saveGuestNote(d1(), { ...scope, attendeeId: 'g-rui', note: 'Likes it strong.' });
    expect(await (await call('/api/me/tables/t-ana', { actor: ana })).text()).not.toContain('Likes it strong.');
    expect(await (await call('/api/rsvp/magic-g-rui')).text()).not.toContain('Likes it strong.');
  });
});

describe('the one door', () => {
  it('has no worker file but hostGuestNotes.ts read or write the table', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|js|mjs)$/.test(entry.name)) files.push(path);
      }
    };
    walk(join(__dirname, '../src'));
    const naming = files.filter(file => readFileSync(file, 'utf8').includes('host_guest_notes'));
    expect(naming.map(file => file.replace(/.*worker\/src\//, ''))).toEqual(['hostGuestNotes.ts']);
  });
});
