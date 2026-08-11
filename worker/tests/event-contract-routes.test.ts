import { describe, expect, it } from 'vitest';

import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

type Attendee = {
  id: string;
  event_id: string;
  magic_token: string;
  status: string;
  cancellation_note: string | null;
  notes: string | null;
  first_visit_briefed: number;
  show_in_guest_list: number;
  plus_one: number;
  plus_one_name: string | null;
  total_capacity: number;
  claim_window_minutes: number;
  eid: string;
};

class EventContractDb {
  confirmedTotal = 0;

  attendee: Attendee = {
    id: 'attendee-1',
    event_id: 'event-1',
    magic_token: 'manage-token',
    status: 'confirmed',
    cancellation_note: null,
    notes: null,
    first_visit_briefed: 0,
    show_in_guest_list: 1,
    plus_one: 0,
    plus_one_name: null,
    total_capacity: 12,
    claim_window_minutes: 30,
    eid: 'event-1',
  };

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];

    const statement = {
      bind: (...bound: unknown[]) => {
        values = bound;
        return statement;
      },
      first: async () => {
        if (normalized.includes('where ea.magic_token = ?')) {
          return values[0] === this.attendee.magic_token ? { ...this.attendee } : null;
        }
        if (normalized.includes('select coalesce(sum(1 + plus_one), 0) as total')) {
          return { total: this.confirmedTotal };
        }
        if (normalized.includes("status = 'waitlist'")) return null;
        return null;
      },
      run: async () => {
        if (!normalized.startsWith('update event_attendees set')) return { success: true };

        expect(values.at(-1)).toBe(this.attendee.id);

        const assignments = normalized
          .slice('update event_attendees set '.length, normalized.indexOf(' where id = ?'))
          .split(',')
          .map((assignment) => assignment.trim());

        let valueIndex = 0;
        for (const assignment of assignments) {
          const [column, expression] = assignment.split('=').map((part) => part.trim());
          if (expression === '?') {
            (this.attendee as Record<string, unknown>)[column] = values[valueIndex++];
          } else if (expression.startsWith("'")) {
            (this.attendee as Record<string, unknown>)[column] = expression.slice(1, -1);
          }
        }
        return { success: true };
      },
    };

    return statement;
  }
}

async function updateRsvp(db: EventContractDb, body: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://test.dev/api/rsvp/manage-token', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db } as any);

  return { response, body: await response.json() as Record<string, unknown> };
}

describe('public RSVP update contract', () => {
  it('persists canonical cancellation status and note', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, {
      status: 'cancelled',
      cancellation_note: 'Travel',
    });

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, status: 'cancelled', cancellation_note: 'Travel' });
    expect(db.attendee).toMatchObject({ status: 'cancelled', cancellation_note: 'Travel' });
  });

  it('persists attendee notes and first-visit briefing state', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, {
      notes: 'No stairs',
      first_visit_briefed: 1,
    });

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, notes: 'No stairs', first_visit_briefed: 1 });
    expect(db.attendee).toMatchObject({ notes: 'No stairs', first_visit_briefed: 1 });
  });

  it('preserves guest-list visibility updates through normalization', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, { show_in_guest_list: false });

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, show_in_guest_list: 0 });
    expect(db.attendee.show_in_guest_list).toBe(0);
  });

  it('preserves plus-one updates alongside normalized fields', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, {
      notes: 'Seated together',
      plus_one: true,
      plus_one_name: 'Ari',
    });

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, notes: 'Seated together' });
    expect(db.attendee).toMatchObject({
      notes: 'Seated together',
      plus_one: 1,
      plus_one_name: 'Ari',
    });
  });

  it('rejects a full-capacity mixed update without persisting any attendee fields', async () => {
    const db = new EventContractDb();
    db.confirmedTotal = db.attendee.total_capacity;
    const before = { ...db.attendee };

    const result = await updateRsvp(db, {
      notes: 'Seated together',
      first_visit_briefed: 1,
      show_in_guest_list: false,
      plus_one: true,
      plus_one_name: 'Ari',
    });

    expect(result.response.status).toBe(409);
    expect(result.body).toEqual({ error: 'No capacity for plus one' });
    expect(db.attendee).toEqual(before);
  });

  it('returns a client error for malformed RSVP flags', async () => {
    const db = new EventContractDb();
    const before = { ...db.attendee };

    const result = await updateRsvp(db, { first_visit_briefed: 'yes' });

    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'first_visit_briefed must be a boolean or 0/1' });
    expect(db.attendee).toEqual(before);
  });

  it('keeps legacy cancel requests working', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, { cancel: true });

    expect(result.body).toMatchObject({ success: true, status: 'cancelled' });
    expect(db.attendee.status).toBe('cancelled');
  });

  it('cancels before validating unrelated stale update flags', async () => {
    const db = new EventContractDb();

    const result = await updateRsvp(db, {
      status: 'cancelled',
      cancellation_note: 'Travel',
      show_in_guest_list: 'false',
    });

    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, status: 'cancelled', cancellation_note: 'Travel' });
    expect(db.attendee).toMatchObject({
      status: 'cancelled',
      cancellation_note: 'Travel',
      show_in_guest_list: 1,
    });
  });
});

const JWT_SECRET = 'event-contract-secret';

function seedEventContractDb() {
  const db = new SqliteD1();
  seedIdentity(db, { userId: 'host-a', accountId: 'account-a', accountSlug: 'shop-a' });
  seedIdentity(db, { userId: 'host-b', accountId: 'account-b', accountSlug: 'shop-b' });
  db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, event_end_date, total_capacity, location_name, timezone,
     status, lifecycle_status, public_visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      'event-a', 'account-a', 'cliff-tea', 'Cliff Tea', '2020-01-10T10:00:00Z', '2020-01-10T12:00:00Z',
      12, 'Old room', 'Asia/Taipei', 'active', 'published', 'public',
    );
  db.sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, event_date, total_capacity)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('event-b', 'account-b', 'other-tea', 'Other Tea', '2020-02-10T10:00:00Z', 8);
  return db;
}

async function adminEventRequest(
  db: SqliteD1,
  path: string,
  init: RequestInit = {},
  accountId = 'account-a',
  userId = 'host-a',
  extraEnv: Record<string, unknown> = {},
) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await signedToken(JWT_SECRET, {
    sub: userId,
    email: `${userId}@test.dev`,
    name: userId,
    active_account_id: accountId,
  })}`);
  headers.set('X-Teajia-Account', accountId);
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), {
    DB: db,
    JWT_SECRET,
    ...extraEnv,
  } as any);
}

function seedPostSessionGuest(db: SqliteD1, options: {
  lifecycle?: 'published' | 'completed' | 'archived';
  recap?: 'draft' | 'published';
  status?: 'confirmed' | 'requested' | 'cancelled';
  attended?: number;
} = {}) {
  db.sqlite.prepare(`UPDATE events SET lifecycle_status = ?, recap_status = ? WHERE id = ?`)
    .run(options.lifecycle ?? 'completed', options.recap ?? 'published', 'event-a');
  db.sqlite.prepare(`INSERT INTO event_attendees
    (id, account_id, event_id, full_name, magic_token, status, attended)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      'guest-a',
      'account-a',
      'event-a',
      'Guest',
      'guest-token',
      options.status ?? 'confirmed',
      options.attended ?? 1,
    );
}

function submitGuestNotes(db: SqliteD1, body: unknown) {
  return worker.fetch(new Request('https://worker.test/api/rsvp/guest-token/tasting-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db } as any);
}

function submitGuestNotesRaw(db: SqliteD1, body: string) {
  return worker.fetch(new Request('https://worker.test/api/rsvp/guest-token/tasting-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }), { DB: db } as any);
}

function seedPostSessionRecord(db: SqliteD1) {
  db.sqlite.prepare(`INSERT INTO event_post_session
    (id, account_id, event_id, session_notes, gallery_images, tea_ledger,
     shared_tasting_notes, host_notes, host_changes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'post-a',
    'account-a',
    'event-a',
    'Shared reflection',
    '["public.jpg"]',
    '{"teas":["Rou Gui"]}',
    '["Curated reflection"]',
    'Private host note',
    'Private host change',
  );
}

function getPublicRecap(db: SqliteD1) {
  return worker.fetch(new Request('https://worker.test/api/events/cliff-tea/recap'), { DB: db } as any);
}

describe('Events Release 1 persisted route contracts', () => {
  it('creates active events with a published lifecycle and an eligible public menu', async () => {
    const db = seedEventContractDb();
    try {
      const created = await adminEventRequest(db, '/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'created-active',
          title: 'Created Active',
          event_date: '2031-01-01T10:00',
          total_capacity: 8,
          status: 'active',
        }),
      });
      const createdBody = await created.json() as Record<string, unknown>;
      expect(created.status).toBe(201);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get(createdBody.id as string))
        .toEqual({ status: 'active', lifecycle_status: 'published' });

      db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, brew_order)
        VALUES (?, ?, ?, ?, ?)`)
        .run('created-active-menu', 'account-a', createdBody.id, 'Public Tea', 1);
      const publicMenu = await worker.fetch(new Request('https://worker.test/api/events/created-active/tea-menu'), { DB: db } as any);
      expect(publicMenu.status).toBe(200);
      expect(await publicMenu.json()).toEqual([expect.objectContaining({ id: 'created-active-menu', custom_name: 'Public Tea' })]);
    } finally {
      db.close();
    }
  });

  it('keeps default draft events unavailable to the public menu', async () => {
    const db = seedEventContractDb();
    try {
      const created = await adminEventRequest(db, '/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'created-draft',
          title: 'Created Draft',
          event_date: '2031-01-01T10:00',
          total_capacity: 8,
        }),
      });
      const createdBody = await created.json() as Record<string, unknown>;
      expect(created.status).toBe(201);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get(createdBody.id as string))
        .toEqual({ status: 'draft', lifecycle_status: 'draft' });

      const publicMenu = await worker.fetch(new Request('https://worker.test/api/events/created-draft/tea-menu'), { DB: db } as any);
      expect(publicMenu.status).toBe(404);
    } finally {
      db.close();
    }
  });

  it('synchronizes draft to active/published and makes the public menu eligible', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO events
        (id, account_id, slug, title, event_date, total_capacity, status, lifecycle_status)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', 'draft')`)
        .run('event-promote', 'account-a', 'event-promote', 'Promoted Event', '2031-01-01T10:00', 8);
      db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, brew_order)
        VALUES (?, ?, ?, ?, ?)`)
        .run('event-promote-menu', 'account-a', 'event-promote', 'Promoted Tea', 1);

      const updated = await adminEventRequest(db, '/api/admin/events/event-promote', {
        method: 'PUT',
        body: JSON.stringify({ status: 'active' }),
      });
      expect(updated.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-promote'))
        .toEqual({ status: 'active', lifecycle_status: 'published' });

      const publicMenu = await worker.fetch(new Request('https://worker.test/api/events/event-promote/tea-menu'), { DB: db } as any);
      expect(publicMenu.status).toBe(200);
    } finally {
      db.close();
    }
  });

  it('synchronizes legal canonical-only lifecycle transitions into the legacy status', async () => {
    const db = seedEventContractDb();
    try {
      const registrationClosed = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ lifecycle_status: 'registration_closed' }),
      });
      expect(registrationClosed.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'closed', lifecycle_status: 'registration_closed' });

      const completed = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ lifecycle_status: 'completed' }),
      });
      expect(completed.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'closed', lifecycle_status: 'completed' });

      const archived = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ lifecycle_status: 'archived' }),
      });
      expect(archived.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'archived', lifecycle_status: 'archived' });
    } finally {
      db.close();
    }
  });

  it('rejects illegal canonical and legacy transitions without mutation', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`UPDATE events SET status = 'archived', lifecycle_status = 'archived' WHERE id = ?`)
        .run('event-a');

      const canonical = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ lifecycle_status: 'published' }),
      });
      expect(canonical.status).toBe(400);
      expect(await canonical.json()).toEqual({ error: 'Invalid lifecycle transition from archived to published' });
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'archived', lifecycle_status: 'archived' });

      const legacy = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ status: 'active' }),
      });
      expect(legacy.status).toBe(400);
      expect(await legacy.json()).toEqual({ error: 'Invalid lifecycle transition from archived to published' });
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'archived', lifecycle_status: 'archived' });
    } finally {
      db.close();
    }
  });

  it.each(['completed', 'cancelled'])('preserves canonical %s for a legacy closed no-op edit', async (lifecycleStatus) => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`UPDATE events SET status = 'closed', lifecycle_status = ? WHERE id = ?`)
        .run(lifecycleStatus, 'event-a');

      const response = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ title: `Edited ${lifecycleStatus}`, status: 'closed' }),
      });
      expect(response.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT title, status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ title: `Edited ${lifecycleStatus}`, status: 'closed', lifecycle_status: lifecycleStatus });
    } finally {
      db.close();
    }
  });

  it('rejects a stale lifecycle transition without overwriting the concurrent state', async () => {
    const db = seedEventContractDb();
    let injectedRace = false;
    const racingDb = {
      sqlite: db.sqlite,
      prepare(sql: string) {
        const statement = db.prepare(sql);
        const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!injectedRace && normalized === 'select status, lifecycle_status from events where id = ? and account_id = ?') {
          const wrapped = {
            bind(...values: unknown[]) {
              statement.bind(...values);
              return wrapped;
            },
            first<T>() {
              const result = statement.first<T>();
              db.sqlite.prepare(`UPDATE events SET status = 'closed', lifecycle_status = 'cancelled' WHERE id = ?`)
                .run('event-a');
              injectedRace = true;
              return result;
            },
          };
          return wrapped;
        }
        return statement;
      },
      batch: db.batch.bind(db),
      exec: db.exec.bind(db),
    } as unknown as SqliteD1;

    try {
      const response = await adminEventRequest(racingDb, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Stale edit', lifecycle_status: 'registration_closed' }),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Event lifecycle changed; retry the update' });
      expect(db.sqlite.prepare(`SELECT title, status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ title: 'Cliff Tea', status: 'closed', lifecycle_status: 'cancelled' });
    } finally {
      db.close();
    }
  });

  it.each([
    ['closed', 'registration_closed'],
    ['archived', 'archived'],
  ])('maps legacy %s updates to canonical %s', async (status, lifecycleStatus) => {
    const db = seedEventContractDb();
    try {
      const created = await adminEventRequest(db, '/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          slug: `created-${status}`,
          title: `Created ${status}`,
          event_date: '2031-01-01T10:00',
          total_capacity: 8,
          status,
        }),
      });
      const createdBody = await created.json() as Record<string, unknown>;
      expect(created.status).toBe(201);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get(createdBody.id as string))
        .toEqual({ status, lifecycle_status: lifecycleStatus });

      if (status === 'archived') {
        db.sqlite.prepare(`UPDATE events SET status = 'closed', lifecycle_status = 'completed' WHERE id = ?`)
          .run('event-a');
      }

      const response = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      expect(response.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status, lifecycle_status: lifecycleStatus });
    } finally {
      db.close();
    }
  });

  it('rejects invalid or inconsistent lifecycle text without persisting status', async () => {
    const db = seedEventContractDb();
    try {
      const consistentUpdate = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ status: 'active', lifecycle_status: 'published' }),
      });
      expect(consistentUpdate.status).toBe(200);

      const invalidLegacy = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ status: 'published' }),
      });
      expect(invalidLegacy.status).toBe(400);
      expect(await invalidLegacy.json()).toEqual({ error: 'Invalid event status' });

      const invalidCanonical = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ lifecycle_status: 'bogus' }),
      });
      expect(invalidCanonical.status).toBe(400);
      expect(await invalidCanonical.json()).toEqual({ error: 'Invalid lifecycle_status' });

      const conflictingUpdate = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed', lifecycle_status: 'published' }),
      });
      expect(conflictingUpdate.status).toBe(400);
      expect(await conflictingUpdate.json()).toEqual({ error: 'lifecycle_status must match status' });

      const conflictingCreate = await adminEventRequest(db, '/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'conflicting-lifecycle',
          title: 'Conflicting Lifecycle',
          event_date: '2031-01-01T10:00',
          total_capacity: 8,
          status: 'active',
          lifecycle_status: 'draft',
        }),
      });
      expect(conflictingCreate.status).toBe(400);
      expect(await conflictingCreate.json()).toEqual({ error: 'lifecycle_status must match status' });
      expect(db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ status: 'active', lifecycle_status: 'published' });
      expect(db.sqlite.prepare(`SELECT id FROM events WHERE slug = ?`).get('conflicting-lifecycle')).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it('normalizes legacy update aliases before allowlisting and lets canonical keys win', async () => {
    const db = seedEventContractDb();
    try {
      const response = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({
          end_date: '2030-01-01T10:00:00Z',
          event_end_date: '2030-01-01T12:00:00Z',
          capacity: 99,
          total_capacity: 17,
          location: 'legacy-room',
          location_name: 'Canonical room',
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(db.sqlite.prepare(`SELECT event_end_date, total_capacity, location_name FROM events WHERE id = ?`)
        .get('event-a')).toEqual({
        event_end_date: '2030-01-01T12:00:00Z',
        total_capacity: 17,
        location_name: 'Canonical room',
      });
    } finally {
      db.close();
    }
  });

  it('maps legacy update aliases into canonical persisted columns', async () => {
    const db = seedEventContractDb();
    try {
      const response = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({ end_date: '2031-03-04T13:00:00Z', capacity: 21 }),
      });

      expect(response.status).toBe(200);
      expect(db.sqlite.prepare(`SELECT event_end_date, total_capacity FROM events WHERE id = ?`)
        .get('event-a')).toEqual({ event_end_date: '2031-03-04T13:00:00Z', total_capacity: 21 });
    } finally {
      db.close();
    }
  });

  it('ignores non-schema update keys while persisting canonical fields', async () => {
    const db = seedEventContractDb();
    try {
      const response = await adminEventRequest(db, '/api/admin/events/event-a', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Canonical title',
          price_usd: 90,
          display_currency: 'USD',
          notes: 'internal',
          host_name: 'Host',
          event_type: 'legacy',
          max_guests: 40,
          booking_cutoff_hours: 12,
          private: true,
          image_url: 'https://media.test/legacy.jpg',
          flyer_url: 'https://media.test/flyer.jpg',
          venue_space_id: 'legacy-space',
          session_template_id: 'legacy-template',
          meta_json: '{}',
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(db.sqlite.prepare(`SELECT title, flyer_image_url, venue_id FROM events WHERE id = ?`)
        .get('event-a')).toEqual({ title: 'Canonical title', flyer_image_url: null, venue_id: null });
    } finally {
      db.close();
    }
  });

  it('persists canonical and legacy tea-menu request envelopes', async () => {
    const db = seedEventContractDb();
    try {
      const canonical = await adminEventRequest(db, '/api/admin/events/event-a/tea-menu', {
        method: 'POST',
        body: JSON.stringify({ items: [{ custom_name: 'Rou Gui', brew_order: 1 }] }),
      });
      const legacy = await adminEventRequest(db, '/api/admin/events/event-a/tea-menu', {
        method: 'POST',
        body: JSON.stringify([{ custom_name: 'Shui Xian', brew_order: 2 }]),
      });

      expect(canonical.status).toBe(200);
      expect(await canonical.json()).toEqual({ success: true, count: 1 });
      expect(legacy.status).toBe(200);
      expect(await legacy.json()).toEqual({ success: true, count: 1 });
      expect(db.sqlite.prepare(`SELECT account_id, event_id, custom_name, brew_order
        FROM event_tea_menu ORDER BY brew_order`).all()).toEqual([
        { account_id: 'account-a', event_id: 'event-a', custom_name: 'Rou Gui', brew_order: 1 },
        { account_id: 'account-a', event_id: 'event-a', custom_name: 'Shui Xian', brew_order: 2 },
      ]);
    } finally {
      db.close();
    }
  });

  it('keeps the exact attendee projection available for an archived published recap', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { lifecycle: 'archived' });
      seedPostSessionRecord(db);
      db.sqlite.prepare(`INSERT INTO event_consents (id, account_id, event_id, attendee_id)
        VALUES (?, ?, ?, ?)`).run('consent-a', 'account-a', 'event-a', 'guest-a');
      expect(db.sqlite.prepare(`SELECT photography, public_quote, review_publication, contact_exchange
        FROM event_consents WHERE id = ?`).get('consent-a')).toEqual({
        photography: 0,
        public_quote: 0,
        review_publication: 0,
        contact_exchange: 0,
      });
      db.sqlite.prepare(`INSERT INTO event_tasting_notes
        (id, account_id, event_id, attendee_id, impression)
        VALUES (?, ?, ?, ?, ?)`).run(
        'private-note', 'account-a', 'event-a', 'guest-a', 'Private guest reflection',
      );

      const response = await worker.fetch(
        new Request('https://worker.test/api/rsvp/guest-token/post-session'),
        { DB: db } as any,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        event_id: 'event-a',
        session_notes: 'Shared reflection',
        gallery_images: ['public.jpg'],
        tea_ledger: { teas: ['Rou Gui'] },
        shared_tasting_notes: ['Curated reflection'],
      });
    } finally {
      db.close();
    }
  });

  it('publishes post-session content atomically through the admin API for public and attendee recap access', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { recap: 'draft' });
      db.sqlite.prepare(`UPDATE events SET status = 'closed', public_visibility = 'public' WHERE id = ?`)
        .run('event-a');

      const published = await adminEventRequest(db, '/api/admin/events/event-a/post-session', {
        method: 'POST',
        body: JSON.stringify({
          recap_status: 'published',
          session_notes: 'Published reflection',
          gallery_images: ['published.jpg'],
          shared_tasting_notes: ['Curated public note'],
          host_notes: 'Private host note',
        }),
      });

      expect(published.status).toBe(200);
      expect(await published.json()).toEqual({ success: true });
      expect(db.sqlite.prepare(`SELECT recap_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ recap_status: 'published' });

      const publicResponse = await getPublicRecap(db);
      expect(publicResponse.status).toBe(200);
      expect(await publicResponse.json()).toEqual({
        event: {
          id: 'event-a',
          slug: 'cliff-tea',
          title: 'Cliff Tea',
          subtitle: null,
          event_date: '2020-01-10T10:00:00Z',
          flyer_image_url: null,
        },
        post_session: {
          id: expect.any(String),
          event_id: 'event-a',
          session_notes: 'Published reflection',
          gallery_images: ['published.jpg'],
          shared_tasting_notes: ['Curated public note'],
        },
        tea_menu: [],
      });

      const attendeeResponse = await worker.fetch(
        new Request('https://worker.test/api/rsvp/guest-token/post-session'),
        { DB: db } as any,
      );
      expect(attendeeResponse.status).toBe(200);
      expect(await attendeeResponse.json()).toEqual({
        event_id: 'event-a',
        session_notes: 'Published reflection',
        gallery_images: ['published.jpg'],
        tea_ledger: null,
        shared_tasting_notes: ['Curated public note'],
      });
    } finally {
      db.close();
    }
  });

  it('returns the public projection for an archived published recap from an eligible account', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { lifecycle: 'archived' });
      seedPostSessionRecord(db);

      const response = await getPublicRecap(db);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        event: {
          id: 'event-a',
          slug: 'cliff-tea',
          title: 'Cliff Tea',
          subtitle: null,
          event_date: '2020-01-10T10:00:00Z',
          flyer_image_url: null,
        },
        post_session: {
          id: 'post-a',
          event_id: 'event-a',
          session_notes: 'Shared reflection',
          gallery_images: ['public.jpg'],
          shared_tasting_notes: ['Curated reflection'],
        },
        tea_menu: [],
      });
    } finally {
      db.close();
    }
  });

  it.each([
    ['draft lifecycle', `UPDATE events SET status = 'closed', lifecycle_status = 'draft', recap_status = 'published' WHERE id = 'event-a'`],
    ['registration-closed lifecycle', `UPDATE events SET status = 'closed', lifecycle_status = 'registration_closed', recap_status = 'published' WHERE id = 'event-a'`],
    ['cancelled lifecycle', `UPDATE events SET status = 'closed', lifecycle_status = 'cancelled', recap_status = 'published' WHERE id = 'event-a'`],
    ['draft recap', `UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'draft' WHERE id = 'event-a'`],
    ['private visibility', `UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'published', public_visibility = 'private' WHERE id = 'event-a'`],
    ['unlisted visibility', `UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'published', public_visibility = 'unlisted' WHERE id = 'event-a'`],
    ['inactive account', `UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'published' WHERE id = 'event-a'; UPDATE accounts SET status = 'suspended' WHERE id = 'account-a'`],
    ['disabled public account', `UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'published' WHERE id = 'event-a'; UPDATE accounts SET public_enabled = 0 WHERE id = 'account-a'`],
  ])('hides a public recap for %s', async (_label, mutation) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionRecord(db);
      db.exec(mutation);

      const response = await getPublicRecap(db);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Recap not found' });
    } finally {
      db.close();
    }
  });

  it('requires the public recap child row to belong to the event account', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`UPDATE events SET status = 'closed', lifecycle_status = 'completed', recap_status = 'published'
        WHERE id = ?`).run('event-a');
      db.sqlite.prepare(`INSERT INTO event_post_session
        (id, account_id, event_id, session_notes, host_notes)
        VALUES (?, ?, ?, ?, ?)`).run(
        'cross-account-post', 'account-b', 'event-a', 'Leaked reflection', 'Leaked private note',
      );

      const response = await getPublicRecap(db);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Recap not found' });
    } finally {
      db.close();
    }
  });

  it('rejects invalid or premature recap publication without partially writing post-session content', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionRecord(db);
      db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'published', recap_status = 'draft' WHERE id = ?`)
        .run('event-a');

      const invalid = await adminEventRequest(db, '/api/admin/events/event-a/post-session', {
        method: 'POST',
        body: JSON.stringify({ recap_status: 'hidden', session_notes: 'Invalid mutation' }),
      });
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toEqual({ error: 'Invalid recap_status' });

      const premature = await adminEventRequest(db, '/api/admin/events/event-a/post-session', {
        method: 'POST',
        body: JSON.stringify({ recap_status: 'published', session_notes: 'Premature mutation' }),
      });
      expect(premature.status).toBe(409);
      expect(await premature.json()).toEqual({ error: 'Recap can be published only after the event is completed' });

      expect(db.sqlite.prepare(`SELECT recap_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ recap_status: 'draft' });
      expect(db.sqlite.prepare(`SELECT session_notes FROM event_post_session WHERE event_id = ?`).get('event-a'))
        .toEqual({ session_notes: 'Shared reflection' });
    } finally {
      db.close();
    }
  });

  it('does not allow an archived draft recap to be published for the first time', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionRecord(db);
      db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'archived', recap_status = 'draft' WHERE id = ?`)
        .run('event-a');

      const response = await adminEventRequest(db, '/api/admin/events/event-a/post-session', {
        method: 'POST',
        body: JSON.stringify({ recap_status: 'published', session_notes: 'Late publication' }),
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Recap can be published only after the event is completed' });
      expect(db.sqlite.prepare(`SELECT recap_status FROM events WHERE id = ?`).get('event-a'))
        .toEqual({ recap_status: 'draft' });
      expect(db.sqlite.prepare(`SELECT session_notes FROM event_post_session WHERE event_id = ?`).get('event-a'))
        .toEqual({ session_notes: 'Shared reflection' });
    } finally {
      db.close();
    }
  });

  it('hides an unpublished post-session recap from attendee tokens', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { recap: 'draft' });
      seedPostSessionRecord(db);

      const response = await worker.fetch(
        new Request('https://worker.test/api/rsvp/guest-token/post-session'),
        { DB: db } as any,
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Post-session recap not published' });
    } finally {
      db.close();
    }
  });

  it('rejects post-session access before the event lifecycle is completed', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { lifecycle: 'published' });
      seedPostSessionRecord(db);

      const response = await worker.fetch(
        new Request('https://worker.test/api/rsvp/guest-token/post-session'),
        { DB: db } as any,
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Post-session recap is not available until the event is completed' });
    } finally {
      db.close();
    }
  });

  it.each([
    ['cancelled guest', 'cancelled', 1],
    ['unattended guest', 'confirmed', 0],
  ] as const)('rejects post-session access for a %s', async (_label, status, attended) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { status, attended });
      seedPostSessionRecord(db);

      const response = await worker.fetch(
        new Request('https://worker.test/api/rsvp/guest-token/post-session'),
        { DB: db } as any,
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Post-session recap is available only to confirmed attendees' });
    } finally {
      db.close();
    }
  });

  it('rejects tasting notes until the event lifecycle is completed', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { lifecycle: 'published' });
      const response = await submitGuestNotes(db, { notes: [{ impression: 'Too early' }] });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Tasting notes are only available after the event is completed' });
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it.each([
    ['requested attendee', 'requested', 1],
    ['unattended guest', 'confirmed', 0],
  ] as const)('rejects tasting notes from a %s', async (_label, status, attended) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db, { status, attended });
      const response = await submitGuestNotes(db, { notes: [{ impression: 'Not eligible' }] });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Only confirmed attendees marked attended may submit tasting notes' });
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it('rejects a cross-event menu id without partially writing a valid batch', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name, brew_order) VALUES (?, ?, ?, ?, ?)`).run(
        'menu-a', 'account-a', 'event-a', 'Account Tea', 1,
      );
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name, brew_order) VALUES (?, ?, ?, ?, ?)`).run(
        'menu-b', 'account-b', 'event-b', 'Other Tea', 1,
      );

      const response = await submitGuestNotes(db, { notes: [
        { tea_menu_id: 'menu-a', impression: 'Valid' },
        { tea_menu_id: 'menu-b', impression: 'Wrong event' },
      ] });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid tea menu item' });
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it('rejects malformed menu ids and idempotently upserts a null-menu note', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);

      const malformed = await submitGuestNotes(db, { notes: [{ tea_menu_id: 7, impression: 'Invalid' }] });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toEqual({ error: 'Invalid tasting note' });

      const canonical = await submitGuestNotes(db, {
        notes: [{ tea_menu_id: null, rating: 5, impression: 'Mineral', is_favorite: true }],
      });
      const legacy = await submitGuestNotes(db, [
        { tea_menu_id: null, rating: 4, impression: 'Orchid' },
      ]);

      expect(canonical.status).toBe(201);
      expect(await canonical.json()).toEqual({ success: true, count: 1 });
      expect(legacy.status).toBe(201);
      expect(await legacy.json()).toEqual({ success: true, count: 1 });
      expect(db.sqlite.prepare(`SELECT account_id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite
        FROM event_tasting_notes`).all()).toEqual([
        {
          account_id: 'account-a',
          event_id: 'event-a',
          attendee_id: 'guest-a',
          tea_menu_id: null,
          rating: 4,
          impression: 'Orchid',
          is_favorite: 0,
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('replaces a legacy null-account note under the migrated unique index', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      db.sqlite.prepare(`INSERT INTO event_tasting_notes
        (id, account_id, event_id, attendee_id, tea_menu_id, rating, impression)
        VALUES (?, NULL, ?, ?, NULL, ?, ?)`).run(
        'legacy-null-account-note', 'event-a', 'guest-a', 2, 'Legacy reflection',
      );

      const response = await submitGuestNotes(db, {
        notes: [{ tea_menu_id: null, rating: 5, impression: 'Replacement reflection' }],
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ success: true, count: 1 });
      expect(db.sqlite.prepare(`
        SELECT account_id, event_id, attendee_id, tea_menu_id, rating, impression
        FROM event_tasting_notes
      `).all()).toEqual([{
        account_id: 'account-a',
        event_id: 'event-a',
        attendee_id: 'guest-a',
        tea_menu_id: null,
        rating: 5,
        impression: 'Replacement reflection',
      }]);
    } finally {
      db.close();
    }
  });

  it.each([
    ['invalid JSON', '{'],
    ['top-level null', 'null'],
    ['top-level number', '7'],
    ['top-level string', '"notes"'],
  ])('returns 400 without writes for %s tasting-note payloads', async (_label, body) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);

      const response = await submitGuestNotesRaw(db, body);

      expect(response.status).toBe(400);
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it.each([
    ['rating below range', { rating: 0 }],
    ['rating above range', { rating: 6 }],
    ['fractional rating', { rating: 2.5 }],
    ['string rating', { rating: '5' }],
    ['non-string impression', { impression: 7 }],
    ['string favorite', { is_favorite: 'true' }],
    ['out-of-range favorite', { is_favorite: 2 }],
    ['null favorite', { is_favorite: null }],
  ])('rejects malformed tasting-note input: %s', async (_label, note) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      const response = await submitGuestNotes(db, { notes: [note] });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid tasting note' });
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it.each([
    ['duplicate menu key', [{ tea_menu_id: 'menu-a' }, { tea_menu_id: 'menu-a' }]],
    ['duplicate null key', [{ tea_menu_id: null }, { tea_menu_id: null }]],
  ])('rejects %s before writing the batch', async (_label, notes) => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name) VALUES (?, ?, ?, ?)`)
        .run('menu-a', 'account-a', 'event-a', 'Rou Gui');

      const response = await submitGuestNotes(db, { notes });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Duplicate tasting note key' });
      expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM event_tasting_notes`).get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it('trims impression text, maps blank to null, and accepts boolean-compatible 0/1 favorites', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name) VALUES (?, ?, ?, ?)`)
        .run('menu-a', 'account-a', 'event-a', 'Rou Gui');

      const first = await submitGuestNotes(db, {
        notes: [{ tea_menu_id: 'menu-a', rating: 3, impression: '  Orchid  ', is_favorite: 1 }],
      });
      expect(first.status).toBe(201);
      expect(db.sqlite.prepare(`SELECT rating, impression, is_favorite FROM event_tasting_notes`).get())
        .toEqual({ rating: 3, impression: 'Orchid', is_favorite: 1 });

      const second = await submitGuestNotes(db, {
        notes: [{ tea_menu_id: 'menu-a', rating: null, impression: '   ', is_favorite: 0 }],
      });
      expect(second.status).toBe(201);
      expect(db.sqlite.prepare(`SELECT rating, impression, is_favorite FROM event_tasting_notes`).get())
        .toEqual({ rating: null, impression: null, is_favorite: 0 });
    } finally {
      db.close();
    }
  });

  it('persists canonical and legacy tasting-note request envelopes', async () => {
    const db = seedEventContractDb();
    try {
      seedPostSessionGuest(db);
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name, brew_order) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`).run(
        'menu-a', 'account-a', 'event-a', 'Rou Gui', 1,
        'menu-b', 'account-a', 'event-a', 'Shui Xian', 2,
      );

      const canonical = await submitGuestNotes(db, {
        notes: [{ tea_menu_id: 'menu-a', rating: 5, impression: 'Mineral', is_favorite: true }],
      });
      const legacy = await submitGuestNotes(db, [
        { tea_menu_id: 'menu-b', rating: 4, impression: 'Orchid' },
      ]);

      expect(canonical.status).toBe(201);
      expect(await canonical.json()).toEqual({ success: true, count: 1 });
      expect(legacy.status).toBe(201);
      expect(await legacy.json()).toEqual({ success: true, count: 1 });
      expect(db.sqlite.prepare(`SELECT account_id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite
        FROM event_tasting_notes ORDER BY created_at, rowid`).all()).toEqual([
        { account_id: 'account-a', event_id: 'event-a', attendee_id: 'guest-a', tea_menu_id: 'menu-a', rating: 5, impression: 'Mineral', is_favorite: 1 },
        { account_id: 'account-a', event_id: 'event-a', attendee_id: 'guest-a', tea_menu_id: 'menu-b', rating: 4, impression: 'Orchid', is_favorite: 0 },
      ]);
    } finally {
      db.close();
    }
  });

  it('requires a slug and new date, then returns the scoped persisted duplicate', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, custom_name, brew_order) VALUES (?, ?, ?, ?, ?)`)
        .run('source-menu', 'account-a', 'event-a', 'Rou Gui', 1);
      const missingDate = await adminEventRequest(db, '/api/admin/events/event-a/duplicate', {
        method: 'POST',
        body: JSON.stringify({ slug: 'cliff-tea-again' }),
      });
      expect(missingDate.status).toBe(400);
      expect(await missingDate.json()).toEqual({ error: 'slug and event_date are required' });

      const response = await adminEventRequest(db, '/api/admin/events/event-a/duplicate', {
        method: 'POST',
        body: JSON.stringify({ slug: 'cliff-tea-again', event_date: '2032-05-06T10:00:00Z' }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        id: expect.any(String),
        account_id: 'account-a',
        slug: 'cliff-tea-again',
        title: 'Cliff Tea',
        event_date: '2032-05-06T10:00:00Z',
        event_end_date: '2032-05-06T12:00:00.000Z',
        status: 'draft',
      });
      expect(db.sqlite.prepare(`SELECT account_id, slug, title, event_date, event_end_date, status FROM events WHERE id = ?`)
        .get(body.id as string)).toEqual({
        account_id: 'account-a',
        slug: 'cliff-tea-again',
        title: 'Cliff Tea',
        event_date: '2032-05-06T10:00:00Z',
        event_end_date: '2032-05-06T12:00:00.000Z',
        status: 'draft',
      });
      expect(db.sqlite.prepare(`SELECT account_id, event_id, custom_name, brew_order
        FROM event_tea_menu WHERE event_id = ?`).get(body.id as string)).toEqual({
        account_id: 'account-a',
        event_id: body.id,
        custom_name: 'Rou Gui',
        brew_order: 1,
      });

      const wrongAccount = await adminEventRequest(
        db,
        '/api/admin/events/event-a/duplicate',
        { method: 'POST', body: JSON.stringify({ slug: 'cross-account-copy', event_date: '2033-01-01T10:00:00Z' }) },
        'account-b',
        'host-b',
      );
      expect(wrongAccount.status).toBe(404);
      expect(db.sqlite.prepare(`SELECT id FROM events WHERE slug = ?`).get('cross-account-copy')).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it.each([
    ['timezone-less', '2032-05-06T10:00', '2032-05-06T12:00'],
    ['explicit offset', '2032-05-06T10:00+08:00', '2032-05-06T12:00+08:00'],
  ])('preserves the requested %s duplicate time representation', async (_label, eventDate, expectedEndDate) => {
    const db = seedEventContractDb();
    try {
      const response = await adminEventRequest(db, '/api/admin/events/event-a/duplicate', {
        method: 'POST',
        body: JSON.stringify({ slug: `cliff-tea-${_label}`, event_date: eventDate }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(body).toMatchObject({ event_date: eventDate, event_end_date: expectedEndDate });
      expect(db.sqlite.prepare(`SELECT event_date, event_end_date FROM events WHERE id = ?`).get(body.id as string))
        .toEqual({ event_date: eventDate, event_end_date: expectedEndDate });
    } finally {
      db.close();
    }
  });

  it.each([
    ['missing', '2030-01-02T12:00:00Z', null],
    ['negative', '2030-01-02T12:00:00Z', '2030-01-02T10:00:00Z'],
    ['invalid', 'not-a-date', '2030-01-02T14:00:00Z'],
    ['incompatible', '2030-01-02T12:00', '2030-01-02T14:00:00Z'],
  ])('persists a null duplicate end date when the source duration is %s', async (caseName, sourceStartDate, sourceEndDate) => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO events
        (id, account_id, slug, title, event_date, event_end_date, total_capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(`event-${caseName}-duration`, 'account-a', `${caseName}-duration`, 'Invalid Duration', sourceStartDate, sourceEndDate, 4);

      const response = await adminEventRequest(db, `/api/admin/events/event-${caseName}-duration/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ slug: `${caseName}-duration-copy`, event_date: '2035-01-02T12:00:00Z' }),
      });
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(body.event_end_date).toBeNull();
      expect(db.sqlite.prepare(`SELECT event_end_date FROM events WHERE id = ?`).get(body.id as string))
        .toEqual({ event_end_date: null });
    } finally {
      db.close();
    }
  });

  it('rejects a mixed-account tea menu atomically before mutations or holds', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?)`)
        .run('product-a', 'account-a', 'oolong', 'Account Tea', 'product-b', 'account-b', 'black', 'Other Tea');
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, product_id, custom_name, brew_order) VALUES (?, ?, ?, ?, ?, ?)`)
        .run('existing-menu', 'account-a', 'event-a', 'product-a', 'Original', 1);

      const response = await adminEventRequest(db, '/api/admin/events/event-a/tea-menu', {
        method: 'POST',
        body: JSON.stringify({ items: [
          { id: 'existing-menu', product_id: 'product-a', custom_name: 'Changed', brew_order: 1 },
          { product_id: 'product-b', custom_name: 'Cross-account', brew_order: 2 },
        ] }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'All tea menu products must belong to the event account' });
      expect(db.sqlite.prepare(`SELECT id, product_id, custom_name, brew_order FROM event_tea_menu ORDER BY brew_order`).all())
        .toEqual([{ id: 'existing-menu', product_id: 'product-a', custom_name: 'Original', brew_order: 1 }]);
      expect(db.sqlite.prepare(`SELECT * FROM stock_holds`).all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('rejects malformed non-null tea-menu product identifiers before mutation', async () => {
    const db = seedEventContractDb();
    try {
      const response = await adminEventRequest(db, '/api/admin/events/event-a/tea-menu', {
        method: 'POST',
        body: JSON.stringify({ items: [{ product_id: 123, custom_name: 'Malformed' }] }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'All tea menu products must belong to the event account' });
      expect(db.sqlite.prepare(`SELECT * FROM event_tea_menu`).all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('returns only explicit public tea-menu fields from same-account joins', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO products
        (id, account_id, type, product_name, given_name, chinese_name, image_url, cost_amount, vendor, stock_grams)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run('product-a', 'account-a', 'oolong', 'Public Tea', 'Rou Gui', '肉桂', 'https://media.test/tea.jpg', 77, 'Secret vendor', 900);
      db.sqlite.prepare(`INSERT INTO event_tea_menu
        (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?),
               (?, ?, ?, ?, ?, ?, datetime('now', '-1 day'), ?),
               (?, ?, ?, ?, ?, ?, datetime('now', '+1 day'), ?)`)
        .run(
          'menu-a', 'account-a', 'event-a', 'product-a', null, 'Roasted cliff tea', null, 1,
          'menu-revealed', 'account-a', 'event-a', 'product-a', 'Revealed tea', 'Already revealed', 2,
          'menu-future', 'account-a', 'event-a', 'product-a', 'Future tea', 'Not revealed', 3,
        );

      const response = await worker.fetch(new Request('https://worker.test/api/events/cliff-tea/tea-menu'), { DB: db } as any);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        {
          id: 'menu-a',
          event_id: 'event-a',
          product_id: 'product-a',
          custom_name: null,
          custom_description: 'Roasted cliff tea',
          reveal_date: null,
          brew_order: 1,
          given_name: 'Rou Gui',
          product_name: 'Public Tea',
          chinese_name: '肉桂',
          product_type: 'oolong',
          product_image_url: 'https://media.test/tea.jpg',
        },
        {
          id: 'menu-revealed',
          event_id: 'event-a',
          product_id: 'product-a',
          custom_name: 'Revealed tea',
          custom_description: 'Already revealed',
          reveal_date: expect.any(String),
          brew_order: 2,
          given_name: 'Rou Gui',
          product_name: 'Public Tea',
          chinese_name: '肉桂',
          product_type: 'oolong',
          product_image_url: 'https://media.test/tea.jpg',
        },
      ]);
    } finally {
      db.close();
    }
  });

  it.each([
    ['inactive legacy status', `UPDATE events SET status = 'draft' WHERE id = 'event-a'`],
    ['draft lifecycle', `UPDATE events SET lifecycle_status = 'draft' WHERE id = 'event-a'`],
    ['private visibility', `UPDATE events SET public_visibility = 'private' WHERE id = 'event-a'`],
    ['unlisted visibility', `UPDATE events SET public_visibility = 'unlisted' WHERE id = 'event-a'`],
    ['inactive account', `UPDATE accounts SET status = 'suspended' WHERE id = 'account-a'`],
    ['disabled public account', `UPDATE accounts SET public_enabled = 0 WHERE id = 'account-a'`],
  ])('hides public tea menus for %s', async (_label, mutation) => {
    const db = seedEventContractDb();
    try {
      db.exec(mutation);
      const response = await worker.fetch(new Request('https://worker.test/api/events/cliff-tea/tea-menu'), { DB: db } as any);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Event not found' });
    } finally {
      db.close();
    }
  });

  it('builds share links from APP_URL and keeps unavailable email delivery unregistered', async () => {
    const db = seedEventContractDb();
    try {
      const share = await adminEventRequest(
        db,
        '/api/admin/events/event-a/share',
        {},
        'account-a',
        'host-a',
        { APP_URL: 'https://events.example/' },
      );
      const shareBody = await share.json() as Record<string, string>;
      expect(share.status).toBe(200);
      expect(shareBody.event_url).toBe('https://events.example/event/cliff-tea');
      expect(shareBody.whatsapp_text).toContain('https://events.example/event/cliff-tea');
      expect(shareBody.email_html).toContain('https://events.example/event/cliff-tea');

      const unavailable = await adminEventRequest(db, '/api/admin/events/event-a/send-emails', {
        method: 'POST',
        body: JSON.stringify({ type: 'invite' }),
      });
      expect(unavailable.status).toBe(404);
      expect(await unavailable.json()).toEqual({ error: 'Not found' });
    } finally {
      db.close();
    }
  });
});
