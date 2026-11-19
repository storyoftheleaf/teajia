import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const secret = 'sessions-policy-fixture';
function fixture() {
  const db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'host', accountId: 'a', role: 'staff', bundles: ['gather'] });
  seedIdentity(db, { userId: 'guest', accountId: 'a', role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'peer', accountId: 'a', role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'guest', accountId: 'b', role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'other', accountId: 'b' });
  db.exec(`
    INSERT INTO events (id,account_id,slug,title,event_date,total_capacity)
    VALUES ('event-a','a','event-a','Private RSVP origin','2026-11-19',8),
           ('event-b','b','event-b','Foreign RSVP','2026-11-19',8);
  `);
  return db;
}
async function request(db: SqliteD1, path: string, userId?: string, accountId = 'a', body?: object, method = body ? 'POST' : 'GET') {
  const headers = new Headers();
  if (userId) {
    headers.set('Authorization', 'Bearer ' + await signedToken(secret, {
      sub: userId, email: `${userId}@test.dev`, active_account_id: accountId,
    }));
    headers.set('X-Teajia-Account', accountId);
  }
  if (body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request('https://fixture.test' + path, { method, headers, body: body && JSON.stringify(body) }), {
    DB: db, JWT_SECRET: secret,
  } as any);
}

describe('RSVP origin and private tasting notes', () => {
  it('keeps standalone sessions and scopes an optional event origin before any write', async () => {
    const db = fixture();
    try {
      const standalone = await request(db, '/api/sessions', 'host', 'a', { title: 'Standalone' });
      expect(standalone.status).toBe(201);
      expect((await standalone.json() as any).session.event_id).toBeNull();
      const linked = await request(db, '/api/sessions', 'host', 'a', { title: 'Linked', event_id: 'event-a', member_ids: ['guest'] });
      expect(linked.status).toBe(201);
      const id = (await linked.json() as any).session.id;
      const reopen = await request(db, '/api/sessions/' + id, 'guest');
      expect(reopen.status).toBe(200);
      expect(await reopen.json()).toMatchObject({ session: { event_id: 'event-a', event_title: 'Private RSVP origin' } });
      expect((await request(db, '/api/sessions/' + id, 'other', 'b')).status).toBe(403);
      expect((await request(db, '/api/sessions/' + id)).status).toBe(401);
      const before = db.sqlite.prepare('SELECT count(*) AS n FROM tasting_sessions').get();
      expect((await request(db, '/api/sessions', 'host', 'a', { event_id: 'event-b' })).status).toBe(404);
      expect((await request(db, '/api/sessions', 'guest', 'a', { event_id: 'event-a' })).status).toBe(403);
      expect((await request(db, '/api/sessions', 'host', 'a', { event_id: 8 })).status).toBe(400);
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM tasting_sessions').get()).toEqual(before);
    } finally { db.close(); }
  });

  it('keeps prose and sensory notes with the author while the live matrix retains ratings', async () => {
    const db = fixture();
    try {
      db.exec(`
        INSERT INTO tasting_sessions (id,account_id,created_by_user_id,title,status,invite_token,created_at)
        VALUES ('flight','a','host','Flight','active','flight-invite','2026-11-19');
        INSERT INTO tasting_session_members (id,session_id,user_id,joined_at)
        VALUES ('guest-member','flight','guest','2026-11-19'),('peer-member','flight','peer','2026-11-19');
        INSERT INTO tasting_session_teas (id,session_id,tea_name) VALUES ('tea','flight','Oolong');
      `);
      db.exec("INSERT INTO tea_compass_entries (id,user_id,account_id,name) VALUES ('feedback-source','host','a','Fixture source')");
      db.exec("UPDATE tasting_session_teas SET compass_entry_id='feedback-source' WHERE id='tea'");
      const payload = { verdict: 'like', notes: 'Private prose', tasting_data: {
        quality: 8, wouldBuy: true, flavor: ['private flavor'], notes: [{ text: 'Private sensory note' }],
      } };
      for (let retry = 0; retry < 2; retry++) {
        expect((await request(db, '/api/sessions/flight/teas/tea/verdict', 'guest', 'a', payload)).status).toBe(200);
      }
      const own = await request(db, '/api/sessions/flight', 'guest');
      expect(JSON.stringify(await own.json())).toContain('Private sensory note');
      const peer = await request(db, '/api/sessions/flight', 'peer');
      expect(JSON.stringify(await peer.json())).not.toContain('Private');
      for (const [url, actor] of [['/api/sessions/flight/verdicts', 'peer'], ['/api/sessions/flight/host-live', 'host']]) {
        const response = await request(db, url, actor);
        expect(response.status).toBe(200);
        const result = await response.json() as any;
        expect(result.verdicts).toEqual([expect.objectContaining({
          user_id: 'guest', verdict: 'like', tasting_data: { quality: 8, wouldBuy: true },
        })]);
        expect(JSON.stringify(result)).not.toContain('Private');
        expect(JSON.stringify(result)).not.toContain('private flavor');
      }
      const feedback = await request(db, '/api/compass/entries/feedback-source/feedback', 'host');
      expect(feedback.status).toBe(200);
      expect(JSON.stringify(await feedback.json())).not.toContain('Private');
      expect((await request(db, '/api/sessions/flight/verdicts', 'other', 'b')).status).toBe(403);
      expect((await request(db, '/api/sessions/flight/verdicts')).status).toBe(401);
      expect((await request(db, '/api/sessions/flight/host-live', 'guest')).status).toBe(403);
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM tasting_session_verdicts').get()).toEqual({ n: 1 });
      for (const table of ['invoices', 'stock_ledger', 'stock_holds']) {
        expect(db.sqlite.prepare('SELECT count(*) AS n FROM ' + table).get()).toEqual({ n: 0 });
      }
    } finally { db.close(); }
  });
});

describe('durable per-member card receipts', () => {
  function shares(db: SqliteD1) {
    db.exec(`
      INSERT INTO tea_compass_entries (id,user_id,account_id,name,status)
      VALUES ('source','host','a','Shared tea','in_stock');
      INSERT INTO compass_shares
        (id,source_entry_id,source_account_id,source_user_id,source_user_name,shared_metadata,invite_token)
      VALUES ('share','source','a','host','Host','{"name":"Shared tea","type":"Oolong"}','invite');
      INSERT INTO tea_compass_entries
        (id,user_id,account_id,name,status,source_entry_id,source_invoice_id,source_invoice_line_id)
      VALUES ('purchase','guest','a','Purchased tea','available_to_taste','source','invoice','line'),
             ('legacy','peer','a','Earlier received copy','incoming','source',NULL,NULL);
    `);
  }
  it('converges concurrent claims, preserves purchases, and isolates stable receipts across users and accounts', async () => {
    const db = fixture();
    try {
      shares(db);
      const results = await Promise.all(Array.from({ length: 3 }, () => request(db, '/api/compass/invite/invite/claim', 'guest', 'a', {})));
      for (const response of results) expect(response.status).toBe(200);
      const bodies = await Promise.all(results.map(response => response.json() as Promise<any>));
      expect(new Set(bodies.map(result => result.entry.id)).size).toBe(1);
      expect(bodies[0].entry.id).not.toBe('purchase');
      expect(bodies[0].receipt_id).toMatch(/^claim_/);
      expect(db.sqlite.prepare("SELECT status,source_invoice_id FROM tea_compass_entries WHERE id='purchase'").get())
        .toEqual({ status: 'available_to_taste', source_invoice_id: 'invoice' });
      const replay = await request(db, '/api/compass/invite/invite/claim', 'guest', 'a', {});
      expect(await replay.json()).toMatchObject({ receipt_id: bodies[0].receipt_id, already_claimed: true });
      const peerSave = await request(db, '/api/compass/invite/invite/claim', 'peer', 'a', {});
      expect(peerSave.status).toBe(200);
      expect((await peerSave.json() as any).entry.id).not.toBe('legacy');
      const secondScope = await request(db, '/api/compass/invite/invite/claim', 'guest', 'b', {});
      expect(secondScope.status).toBe(200);
      expect((await secondScope.json() as any).receipt_id).not.toBe(bodies[0].receipt_id);
      const list = await request(db, '/api/me/received-cards', 'guest');
      expect(list.headers.get('Cache-Control')).toBe('private, no-store');
      expect((await list.json() as any).cards).toHaveLength(1);
      const cardPath = '/api/me/received-cards/' + bodies[0].receipt_id;
      const own = await request(db, cardPath, 'guest');
      expect(await own.json()).toMatchObject({ card: { name: 'Shared tea', entry_id: bodies[0].entry.id } });
      expect((await request(db, cardPath, 'peer')).status).toBe(404);
      expect((await request(db, cardPath, 'guest', 'b')).status).toBe(404);
      expect((await request(db, cardPath, 'host')).status).toBe(404);
      expect((await request(db, cardPath)).status).toBe(401);
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM compass_claim_receipts').get()).toEqual({ n: 3 });
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM customer_tasting_journal').get()).toEqual({ n: 0 });
      db.exec("UPDATE account_members SET status='suspended' WHERE account_id='a' AND user_id='guest'");
      expect((await request(db, cardPath, 'guest')).status).toBe(403);
    } finally { db.close(); }
  });

  it('makes direct-share retry safe for its member and refuses another recipient after acceptance', async () => {
    const db = fixture();
    try {
      shares(db);
      db.exec("UPDATE compass_shares SET invite_token=NULL,target_account_id='a' WHERE id='share'");
      const accept = '/api/compass/shares/share/accept';
      const result = await request(db, accept, 'guest', 'a', {});
      expect(result.status).toBe(200);
      const saved = await result.json() as any;
      expect((await request(db, accept, 'guest', 'a', {})).status).toBe(200);
      expect((await request(db, accept, 'peer', 'a', {})).status).toBe(404);
      expect((await request(db, accept, 'guest', 'b', {})).status).toBe(404);
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM compass_claim_receipts').get()).toEqual({ n: 1 });
      expect((await request(db, '/api/me/received-cards/' + saved.receipt_id, 'guest')).status).toBe(200);
    } finally { db.close(); }
  });

  it('keeps an owned card readable after its invite is withdrawn but denies new claims', async () => {
    const db = fixture();
    try {
      shares(db);
      const result = await request(db, '/api/compass/invite/invite/claim', 'guest', 'a', {});
      const saved = await result.json() as any;
      db.exec("UPDATE compass_shares SET status='declined' WHERE id='share'");
      expect((await request(db, '/api/compass/invite/invite/claim', 'peer', 'a', {})).status).toBe(404);
      expect((await request(db, '/api/me/received-cards/' + saved.receipt_id, 'guest')).status).toBe(200);
    } finally { db.close(); }
  });
});

describe('private session reflections', () => {
  function reflections(db: SqliteD1) {
    db.exec(`
      UPDATE users SET email_verified_at = '2026-11-19' WHERE id IN ('host','guest','peer');
      UPDATE events SET status='closed', lifecycle_status='completed' WHERE id='event-a';
      INSERT INTO customers (id,account_id,name,user_id) VALUES ('host-c','a','Host','host');
      INSERT INTO event_attendees
        (id,account_id,event_id,full_name,email,magic_token,status,attended)
      VALUES ('rsvp','a','event-a','Guest','guest@test.dev','reflection-token','confirmed',1),
             ('no-show','a','event-a','Peer','peer@test.dev','no-show-reflection','confirmed',0);
    `);
  }
  it('binds a verified owner atomically and keeps their reflection private after host customer changes', async () => {
    const db = fixture();
    try {
      reflections(db);
      const path = '/api/rsvp/reflection-token/reflection';
      expect((await request(db, path)).status).toBe(401);
      expect((await request(db, path, 'host', 'a', { reflection: 'Host overwrite' }, 'PUT')).status).toBe(403);
      expect((await request(db, path, 'guest', 'b', { reflection: 'Wrong account' }, 'PUT')).status).toBe(403);
      expect((await request(db, path, 'guest')).status).toBe(404);
      expect(db.sqlite.prepare("SELECT user_id FROM event_attendees WHERE id='rsvp'").get()).toEqual({ user_id: null });
      db.exec("UPDATE event_attendees SET customer_id='host-c' WHERE id='rsvp'");
      const writes = await Promise.all(Array.from({ length: 2 }, () =>
        request(db, path, 'guest', 'a', { reflection: 'My private reflection' }, 'PUT')));
      for (const response of writes) expect(response.status).toBe(200);
      expect(db.sqlite.prepare("SELECT user_id FROM event_attendees WHERE id='rsvp'").get()).toEqual({ user_id: 'guest' });
      db.exec("UPDATE event_attendees SET customer_id=NULL, notes='Host notes' WHERE id='rsvp'");
      db.exec("UPDATE users SET email='changed@test.dev' WHERE id='guest'");
      const read = await request(db, path, 'guest');
      expect(read.status).toBe(200);
      expect(read.headers.get('Cache-Control')).toBe('private, no-store');
      expect(await read.json()).toMatchObject({ reflection: 'My private reflection' });
      expect((await request(db, path, 'host')).status).toBe(404);
      expect((await request(db, path, 'peer')).status).toBe(404);
      expect((await request(db, path, 'guest', 'b')).status).toBe(404);
      const archive = await request(db, '/api/me/session-reflections', 'guest');
      expect((await archive.json() as any).reflections).toEqual([
        expect.objectContaining({ attendee_id: 'rsvp', reflection: 'My private reflection', title: 'Private RSVP origin' }),
      ]);
      const hostArchive = await request(db, '/api/me/session-reflections', 'host');
      expect(await hostArchive.json()).toEqual({ reflections: [] });
      expect((await request(db, '/api/me/session-reflections/rsvp', 'host', 'a', { reflection: 'Host overwrite' }, 'PUT')).status).toBe(404);
      expect((await request(db, '/api/me/session-reflections/rsvp', 'guest', 'a', { reflection: 'Revised privately' }, 'PUT')).status).toBe(200);
      const hostAttendees = await request(db, '/api/admin/events/event-a/attendees', 'host');
      expect(JSON.stringify(await hostAttendees.json())).not.toContain('privately');
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM private_session_reflections').get()).toEqual({ n: 1 });
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM customer_tasting_journal').get()).toEqual({ n: 0 });
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM event_tasting_notes').get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });

  it('refuses unverified, ambiguous, phone-only and no-show binding without writing any owner', async () => {
    const db = fixture();
    try {
      reflections(db);
      const path = '/api/rsvp/reflection-token/reflection';
      const save = () => request(db, path, 'guest', 'a', { reflection: 'Private' }, 'PUT');
      db.exec("UPDATE users SET email_verified_at=NULL WHERE id='guest'");
      expect((await save()).status).toBe(403);
      db.exec("UPDATE users SET email_verified_at='2026-11-19' WHERE id='guest'");
      db.exec("INSERT INTO event_attendees (id,account_id,event_id,full_name,email,magic_token,status,attended) VALUES ('duplicate','a','event-a','Duplicate','GUEST@test.dev','duplicate','confirmed',1)");
      expect((await save()).status).toBe(403);
      db.exec("DELETE FROM event_attendees WHERE id='duplicate'");
      db.exec("UPDATE event_attendees SET email=NULL WHERE id='rsvp'");
      expect((await save()).status).toBe(403);
      db.exec("UPDATE event_attendees SET email='guest@test.dev' WHERE id='rsvp'");
      db.exec("UPDATE events SET lifecycle_status='registration_closed' WHERE id='event-a'");
      expect((await save()).status).toBe(403);
      db.exec("UPDATE events SET lifecycle_status='completed' WHERE id='event-a'");
      expect((await request(db, '/api/rsvp/no-show-reflection/reflection', 'peer', 'a', { reflection: 'Private' }, 'PUT')).status).toBe(403);
      expect(db.sqlite.prepare("SELECT user_id FROM event_attendees WHERE id='rsvp'").get()).toEqual({ user_id: null });
      expect(db.sqlite.prepare('SELECT count(*) AS n FROM private_session_reflections').get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });
});
