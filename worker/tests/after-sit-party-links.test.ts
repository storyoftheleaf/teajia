import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afterSitRoutes } from '../src/afterSitAccess';
import { serveGuestBookReview } from '../src/sessionGuestBook';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

type Env = { DB: D1Database };
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
});
const partyPath = '/api/admin/events/:eventId/after-sit/:attendeeId/party';
const issuePath = '/api/admin/events/:eventId/after-sit/:attendeeId';
const guestBookPath = '/api/after-sit/guest-book';

async function call(method: string, path: string, headers: Record<string, string> = {}, body?: unknown,
  params: Record<string, string> = {}) {
  const route = routes.find(([verb, pattern]) => verb === method && pattern === path);
  if (!route) return new Response(null, { status: 404 });
  const request = new Request(`https://teajia.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return route[2](request, { DB: db as unknown as D1Database }, params);
}

async function partyLink(firstName: unknown = 'Mei', accountId = 'shop-a', attendeeId = 'attendee', eventId = 'event-a') {
  return call('POST', partyPath, { 'Test-Host': accountId }, { first_name: firstName }, { attendeeId, eventId });
}
async function newPartyCredential(firstName = 'Mei') {
  const response = await partyLink(firstName);
  expect(response.status).toBe(200);
  return (await response.json() as { credential: string }).credential;
}
const guestBook = (credential: string, userId: string, body: Record<string, unknown>) =>
  call('POST', guestBookPath, { 'Test-User': userId }, { credential, ...body });

beforeEach(() => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'booker', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'plus-one', accountId: 'shop-a' });
  seedIdentity(db, { userId: 'other', accountId: 'shop-b' });
  db.exec(`
    UPDATE users SET email_verified_at = '2026-11-23' WHERE id = 'booker';
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status) VALUES
      ('event-a', 'shop-a', 'one', 'Tea evening', '2026-11-22', 'completed'),
      ('event-next', 'shop-a', 'next', 'Next sit', '2026-11-22', 'completed'),
      ('event-b', 'shop-b', 'two', 'Other shop sit', '2026-11-22', 'completed');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, magic_token, status, attended) VALUES
      ('attendee', 'shop-a', 'event-a', 'Booker Full Name', 'booker@test.dev', 'booker-token', 'confirmed', 1),
      ('later', 'shop-a', 'event-next', 'Booker Full Name', 'booker@test.dev', 'later-token', 'confirmed', 1),
      ('other', 'shop-b', 'event-b', 'Other Shop', null, 'other-token', 'confirmed', 1);
  `);
});

afterEach(() => db.close());

describe('after-sit party links', () => {
  it('signs a note written through a party link with the party member first name and leaves it for host review', async () => {
    const credential = await newPartyCredential('Mei');
    const sent = await guestBook(credential, 'plus-one', { action: 'send', note: 'Loved the red tea.' });
    expect(sent.status).toBe(200);
    expect(db.sqlite.prepare('SELECT user_id, attendee_id, note, status, signed_name FROM session_guest_book').all()).toEqual([
      { user_id: 'plus-one', attendee_id: 'attendee', note: 'Loved the red tea.', status: 'pending', signed_name: 'Mei' },
    ]);
    const review = await serveGuestBookReview(new Request('https://teajia.test'), db as unknown as D1Database, 'shop-a', 'event-a');
    const { entries } = await review.json() as { entries: Array<{ display_name: string; status: string }> };
    expect(entries).toMatchObject([{ display_name: 'Mei', status: 'pending' }]);
    // The link can read back the person's own pending note, and nobody else's.
    const read = await (await guestBook(credential, 'plus-one', { action: 'read' })).json() as { own: { note: string }; entries: unknown[] };
    expect(read.own.note).toBe('Loved the red tea.');
    expect(read.entries).toEqual([]);
  });

  it('keeps the booking own link signed with the booking name', async () => {
    const issued = await call('POST', issuePath, { 'Test-Host': 'shop-a' }, undefined, { attendeeId: 'attendee', eventId: 'event-a' });
    const { credential } = await issued.json() as { credential: string };
    expect((await guestBook(credential, 'booker', { action: 'send', note: 'A quiet evening.' })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT signed_name FROM session_guest_book').get()).toEqual({ signed_name: null });
    const review = await serveGuestBookReview(new Request('https://teajia.test'), db as unknown as D1Database, 'shop-a', 'event-a');
    expect(await review.json()).toMatchObject({ entries: [{ display_name: 'Booker Full Name' }] });
  });

  it('shows the booking note to a party reader by the booking first name, never the surname (A7-1)', async () => {
    // The old shape: a booking note with no saved signature, already included.
    db.exec(`INSERT INTO session_guest_book (id, account_id, event_id, attendee_id, user_id, note, status, updated_at)
      VALUES ('booking-note', 'shop-a', 'event-a', 'attendee', 'booker', 'A quiet evening.', 'included', '2026-11-22')`);
    const credential = await newPartyCredential('Mei');
    const read = await (await guestBook(credential, 'plus-one', { action: 'read' })).json() as { entries: Array<{ display_name: string }> };
    expect(read.entries).toMatchObject([{ display_name: 'Booker', note: 'A quiet evening.' }]);
    expect(JSON.stringify(read)).not.toContain('Full Name');
    // The host's review keeps the roster name.
    const review = await serveGuestBookReview(new Request('https://teajia.test'), db as unknown as D1Database, 'shop-a', 'event-a');
    expect(await review.json()).toMatchObject({ entries: [{ display_name: 'Booker Full Name' }] });
  });

  it('cannot reach another event or another shop', async () => {
    const credential = await newPartyCredential();
    await guestBook(credential, 'plus-one', { action: 'send', note: 'Only here.' });
    expect(db.sqlite.prepare('SELECT event_id FROM session_guest_book').all()).toEqual([{ event_id: 'event-a' }]);
    // A host cannot issue one for another event's seat, nor for another shop's seat.
    expect((await partyLink('Mei', 'shop-a', 'attendee', 'event-next')).status).toBe(404);
    expect((await partyLink('Mei', 'shop-a', 'other', 'event-b')).status).toBe(404);
    expect((await partyLink('Mei', 'shop-b', 'attendee', 'event-a')).status).toBe(404);
    // Personal links do not open the private setup or photos.
    const photos = await guestBook(credential, 'plus-one', { action: 'photos-read' });
    expect(photos.status).toBe(404);
    expect((await guestBook('f'.repeat(64), 'plus-one', { action: 'send', note: 'x' })).status).toBe(404);
  });

  it('is host only', async () => {
    const attempt = await call('POST', partyPath, {}, { first_name: 'Mei' }, { attendeeId: 'attendee', eventId: 'event-a' });
    expect(attempt.status).toBe(403);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM after_sit_party_links').get()).toEqual({ n: 0 });
  });

  it('needs a first name', async () => {
    expect((await partyLink('')).status).toBe(400);
    expect((await partyLink('   ')).status).toBe(400);
    expect((await partyLink(42)).status).toBe(400);
    expect((await partyLink('x'.repeat(41))).status).toBe(400);
  });

  it('stops working when it expires, when withdrawn, or when attendance is corrected', async () => {
    const credential = await newPartyCredential();
    db.exec('UPDATE after_sit_party_links SET expires_at = unixepoch() - 1');
    expect((await guestBook(credential, 'plus-one', { action: 'send', note: 'Late.' })).status).toBe(404);

    const second = await newPartyCredential('Jo');
    const withdraw = await call('DELETE', issuePath, { 'Test-Host': 'shop-a' }, undefined, { attendeeId: 'attendee', eventId: 'event-a' });
    expect(withdraw.status).toBe(200);
    expect((await guestBook(second, 'plus-one', { action: 'send', note: 'Gone.' })).status).toBe(404);

    const third = await newPartyCredential('Al');
    db.exec("UPDATE event_attendees SET attended = 0 WHERE id = 'attendee'");
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM after_sit_party_links').get()).toEqual({ n: 0 });
    expect((await guestBook(third, 'plus-one', { action: 'send', note: 'Absent.' })).status).toBe(404);
  });
});
