import { describe, expect, it } from 'vitest';

import worker from '../src/index';

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
