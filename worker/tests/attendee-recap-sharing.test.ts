import { expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

it('shares only the confirmed snapshot with attending guests of a completed public event', async () => {
  const db = new SqliteD1();
  const secret = 'attendee-recap-fixture';
  const host = seedIdentity(db, { userId: 'host', accountId: 'account-a', role: 'staff', bundles: ['gather'] });
  const other = seedIdentity(db, { userId: 'other', accountId: 'account-b', role: 'staff', bundles: ['gather'] });
  const viewer = seedIdentity(db, { userId: 'viewer', accountId: 'account-a', role: 'viewer', bundles: [] });
  db.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, status, lifecycle_status, public_visibility)
    VALUES ('event-a','account-a','recap-fixture','Tea Evening','2026-11-16',10,'closed','registration_closed','public');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, attended)
    VALUES ('guest-a','account-a','event-a','Guest','confirmed','guest-token',1),
           ('no-show','account-a','event-a','No show','confirmed','no-show-token',0);
  `);

  async function request(path: string, body?: object, actor?: typeof host, method = body ? 'POST' : 'GET') {
    const headers = new Headers();
    if (actor) {
      const jwt = await signedToken(secret, { sub: actor.userId, email: actor.email, active_account_id: actor.accountId });
      headers.set('Authorization', `Bearer ${jwt}`);
      headers.set('X-Teajia-Account', actor.accountId);
    }
    if (body) headers.set('Content-Type', 'application/json');
    return worker.fetch(new Request(`https://fixture.test${path}`, { method, headers, body: body && JSON.stringify(body) }), {
      DB: db, JWT_SECRET: secret,
    } as any);
  }

  try {
    const event = '/api/admin/events/event-a';
    const share = `${event}/attendee-recap`;
    const draft = `${event}/post-session`;
    const guest = '/api/rsvp/guest-token/post-session';
    const publicRecap = '/api/events/recap-fixture/recap';
    const snapshot = { session_notes: 'Shared recap text' };

    expect((await request(share, snapshot, host)).status).toBe(409);
    expect((await request(event, { lifecycle_status: 'completed' }, host, 'PUT')).status).toBe(200);
    expect((await request(draft, { session_notes: 'Unshared draft', host_notes: 'Private host note' }, host)).status).toBe(200);
    expect((await request(guest)).status).toBe(404);
    expect((await request(share, snapshot, viewer)).status).toBe(403);
    expect((await request(share, snapshot, other)).status).toBe(404);
    expect((await request(share, { session_notes: '  ' }, host)).status).toBe(400);
    expect((await request(share, { ...snapshot, host_notes: 'Private host note' }, host)).status).toBe(200);
    expect((await request(share, snapshot, host)).status).toBe(200);
    expect((await request(draft, { session_notes: 'New draft', host_notes: 'Private host note' }, host)).status).toBe(200);
    const shared = await request(guest);
    expect(shared.status).toBe(200);
    expect(shared.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await shared.json()).toEqual({ event_id: 'event-a', ...snapshot });
    expect((await request('/api/rsvp/no-show-token/post-session')).status).toBe(403);
    expect((await request('/api/rsvp/invalid-token/post-session')).status).toBe(404);
    expect((await request(publicRecap)).status).toBe(404);
    expect(db.sqlite.prepare('SELECT count(*) AS count FROM event_attendee_recaps').get()).toEqual({ count: 1 });

    expect((await request(draft, { recap_status: 'published', session_notes: 'Public recap' }, host)).status).toBe(200);
    expect((await request(share, snapshot, host)).status).toBe(409);
    const legacy = await request(publicRecap);
    expect(legacy.status).toBe(200);
    expect(await legacy.json()).toMatchObject({ post_session: { session_notes: 'Public recap' } });
  } finally {
    db.close();
  }
});
