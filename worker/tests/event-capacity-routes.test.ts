import { afterEach, describe, expect, it } from 'vitest';

import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const JWT_SECRET = 'event-capacity-secret';
const databases: SqliteD1[] = [];

type SeedOptions = {
  capacity?: number;
  requiresApproval?: boolean;
};

function seedCapacityDb(options: SeedOptions = {}) {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, {
    userId: 'host-a',
    accountId: 'account-a',
    accountSlug: 'shop-a',
    bundles: ['gather'],
  });
  db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, total_capacity, status, lifecycle_status, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 'published', ?)`)
    .run(
      'event-a',
      'account-a',
      'capacity-night',
      'Capacity Night',
      '2099-08-10T10:00:00.000Z',
      options.capacity ?? 2,
      options.requiresApproval === false ? 0 : 1,
    );
  return db;
}

function addParticipation(db: SqliteD1, input: {
  id: string;
  status: 'confirmed' | 'requested' | 'waitlist';
  seatStatus?: 'confirmed' | 'requested' | 'held';
  token?: string;
  claimExpiresAt?: string | null;
}) {
  db.sqlite.prepare(`INSERT INTO event_attendees
    (id, account_id, event_id, full_name, email, status, magic_token, claim_expires_at)
    VALUES (?, 'account-a', 'event-a', ?, ?, ?, ?, ?)`)
    .run(
      input.id,
      `Guest ${input.id}`,
      `${input.id}@test.dev`,
      input.status,
      input.token ?? `token-${input.id}`,
      input.claimExpiresAt ?? null,
    );
  db.sqlite.prepare(`INSERT INTO event_party_members
    (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, 'account-a', 'event-a', ?, ?, 1, ?)`)
    .run(
      `seat-${input.id}`,
      input.id,
      `Guest ${input.id}`,
      input.seatStatus ?? (input.status === 'confirmed' ? 'confirmed' : 'requested'),
    );
}

function fillEvent(db: SqliteD1) {
  addParticipation(db, { id: 'confirmed-a', status: 'confirmed' });
  addParticipation(db, { id: 'confirmed-b', status: 'confirmed' });
}

async function adminHeaders() {
  const token = await signedToken(JWT_SECRET, {
    sub: 'host-a',
    email: 'host-a@test.dev',
    name: 'Host A',
    account_id: 'account-a',
  });
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'X-Teajia-Account': 'account-a',
  };
}

async function invoke(db: SqliteD1, path: string, init: RequestInit = {}) {
  const response = await worker.fetch(new Request(`https://test.dev${path}`, init), {
    DB: db,
    JWT_SECRET,
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as any);
  return { response, body: await response.json() as Record<string, unknown> };
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe('atomic event capacity routes', () => {
  it('rejects an instant RSVP at capacity without creating participation or customer state', async () => {
    const db = seedCapacityDb({ requiresApproval: false });
    fillEvent(db);

    const beforeCustomers = db.sqlite.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number };
    const result = await invoke(db, '/api/events/capacity-night/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
      body: JSON.stringify({ full_name: 'Overflow Guest', email: 'overflow@test.dev' }),
    });

    expect(result.response.status).toBe(409);
    expect(result.body).toMatchObject({ code: 'capacity_conflict' });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM event_attendees WHERE email='overflow@test.dev'").get())
      .toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM customers').get()).toEqual(beforeCustomers);
  });

  it('rejects a single approval at capacity without transitioning its party', async () => {
    const db = seedCapacityDb();
    fillEvent(db);
    addParticipation(db, { id: 'requested-one', status: 'requested' });

    const result = await invoke(db, '/api/admin/attendees/requested-one/approve', {
      method: 'PUT',
      headers: await adminHeaders(),
      body: JSON.stringify({ approved_guests: 1 }),
    });

    expect(result.response.status).toBe(409);
    expect(db.sqlite.prepare("SELECT status FROM event_attendees WHERE id='requested-one'").get())
      .toEqual({ status: 'requested' });
    expect(db.sqlite.prepare("SELECT seat_status FROM event_party_members WHERE participation_id='requested-one'").all())
      .toEqual([{ seat_status: 'requested' }]);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM guest_invites WHERE parent_attendee_id='requested-one'").get())
      .toEqual({ count: 0 });
  });

  it('rejects a batch approval at capacity without partially approving the batch', async () => {
    const db = seedCapacityDb({ capacity: 3 });
    fillEvent(db);
    addParticipation(db, { id: 'requested-one', status: 'requested' });
    addParticipation(db, { id: 'requested-two', status: 'requested' });

    const result = await invoke(db, '/api/admin/events/event-a/approve-batch', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({ attendee_ids: ['requested-one', 'requested-two'] }),
    });

    expect(result.response.status).toBe(409);
    expect(db.sqlite.prepare(`SELECT id, status FROM event_attendees
      WHERE id IN ('requested-one','requested-two') ORDER BY id`).all())
      .toEqual([
        { id: 'requested-one', status: 'requested' },
        { id: 'requested-two', status: 'requested' },
      ]);
    expect(db.sqlite.prepare(`SELECT participation_id, seat_status FROM event_party_members
      WHERE participation_id IN ('requested-one','requested-two') ORDER BY participation_id`).all())
      .toEqual([
        { participation_id: 'requested-one', seat_status: 'requested' },
        { participation_id: 'requested-two', seat_status: 'requested' },
      ]);
  });

  it('rejects a waitlist claim at capacity without consuming its offer', async () => {
    const db = seedCapacityDb();
    fillEvent(db);
    addParticipation(db, {
      id: 'waitlisted-one',
      status: 'waitlist',
      token: 'waitlist-token',
      claimExpiresAt: '2099-08-09T10:00:00.000Z',
    });

    const result = await invoke(db, '/api/rsvp/waitlist-token/claim', { method: 'POST' });

    expect(result.response.status).toBe(409);
    expect(db.sqlite.prepare("SELECT status, claim_expires_at FROM event_attendees WHERE id='waitlisted-one'").get())
      .toEqual({ status: 'waitlist', claim_expires_at: '2099-08-09T10:00:00.000Z' });
    expect(db.sqlite.prepare("SELECT seat_status FROM event_party_members WHERE participation_id='waitlisted-one'").get())
      .toEqual({ seat_status: 'requested' });
  });

  it('rejects a legacy guest claim at capacity without claiming the invite or creating an attendee', async () => {
    const db = seedCapacityDb();
    fillEvent(db);
    db.sqlite.prepare(`INSERT INTO guest_invites
      (id, account_id, event_id, parent_attendee_id, invite_token, status)
      VALUES ('invite-full', 'account-a', 'event-a', 'confirmed-a', 'guest-full-token', 'pending')`).run();

    const result = await invoke(db, '/api/guest-invite/guest-full-token/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Guest Claim', email: 'guest-claim@test.dev' }),
    });

    expect(result.response.status).toBe(409);
    expect(db.sqlite.prepare("SELECT status, claimed_attendee_id FROM guest_invites WHERE id='invite-full'").get())
      .toEqual({ status: 'pending', claimed_attendee_id: null });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM event_attendees WHERE email='guest-claim@test.dev'").get())
      .toEqual({ count: 0 });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM event_party_members WHERE invitation_id='invite-full'").get())
      .toEqual({ count: 0 });
  });

  it('claims the same guest token once and records exactly one invitation party member', async () => {
    const db = seedCapacityDb({ capacity: 2 });
    addParticipation(db, { id: 'confirmed-parent', status: 'confirmed' });
    db.sqlite.prepare(`INSERT INTO guest_invites
      (id, account_id, event_id, parent_attendee_id, invite_token, status)
      VALUES ('invite-once', 'account-a', 'event-a', 'confirmed-parent', 'guest-once-token', 'pending')`).run();

    const claim = () => invoke(db, '/api/guest-invite/guest-once-token/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Claimed Guest', email: 'claimed@test.dev' }),
    });
    const [first, second] = await Promise.all([claim(), claim()]);

    expect([first.response.status, second.response.status].sort()).toEqual([201, 409]);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM event_attendees WHERE email='claimed@test.dev'").get())
      .toEqual({ count: 1 });
    expect(db.sqlite.prepare("SELECT invitation_id, seat_status FROM event_party_members WHERE invitation_id='invite-once'").all())
      .toEqual([{ invitation_id: 'invite-once', seat_status: 'confirmed' }]);
  });

  it('counts accepted party members and unexpired waitlist offers as held seats', async () => {
    const db = seedCapacityDb({ capacity: 4 });
    addParticipation(db, { id: 'confirmed-a', status: 'confirmed' });
    addParticipation(db, { id: 'confirmed-b', status: 'confirmed' });
    addParticipation(db, {
      id: 'offered-live',
      status: 'waitlist',
      claimExpiresAt: '2099-08-09T10:00:00.000Z',
    });
    addParticipation(db, {
      id: 'offered-expired',
      status: 'waitlist',
      claimExpiresAt: '2020-01-01T00:00:00.000Z',
    });

    const result = await invoke(db, '/api/events/capacity-night/availability');

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({
      total_capacity: 4,
      confirmed_count: 2,
      offered_count: 1,
      seats_remaining: 1,
      is_full: false,
    });
  });
});
