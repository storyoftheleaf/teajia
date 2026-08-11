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

describe('Events Release 1 persisted route contracts', () => {
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

  it('persists canonical and legacy tasting-note request envelopes', async () => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO event_attendees
        (id, account_id, event_id, full_name, magic_token, status)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run('guest-a', 'account-a', 'event-a', 'Guest', 'guest-token', 'confirmed');

      const canonical = await worker.fetch(new Request('https://worker.test/api/rsvp/guest-token/tasting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: [{ rating: 5, impression: 'Mineral', is_favorite: true }] }),
      }), { DB: db } as any);
      const legacy = await worker.fetch(new Request('https://worker.test/api/rsvp/guest-token/tasting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ rating: 4, impression: 'Orchid' }]),
      }), { DB: db } as any);

      expect(canonical.status).toBe(201);
      expect(await canonical.json()).toEqual({ success: true, count: 1 });
      expect(legacy.status).toBe(201);
      expect(await legacy.json()).toEqual({ success: true, count: 1 });
      expect(db.sqlite.prepare(`SELECT event_id, attendee_id, rating, impression, is_favorite
        FROM event_tasting_notes ORDER BY created_at, rowid`).all()).toEqual([
        { event_id: 'event-a', attendee_id: 'guest-a', rating: 5, impression: 'Mineral', is_favorite: 1 },
        { event_id: 'event-a', attendee_id: 'guest-a', rating: 4, impression: 'Orchid', is_favorite: 0 },
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
    ['missing', null],
    ['negative', '2030-01-02T10:00:00Z'],
  ])('persists a null duplicate end date when the source duration is %s', async (caseName, sourceEndDate) => {
    const db = seedEventContractDb();
    try {
      db.sqlite.prepare(`INSERT INTO events
        (id, account_id, slug, title, event_date, event_end_date, total_capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(`event-${caseName}-duration`, 'account-a', `${caseName}-duration`, 'Invalid Duration', '2030-01-02T12:00:00Z', sourceEndDate, 4);

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
