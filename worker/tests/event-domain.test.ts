import { describe, expect, it } from 'vitest';

import {
  EVENT_TRANSITIONS,
  normalizeEventUpdate,
  normalizeRsvpUpdate,
  publicPostSessionProjection,
  seatAvailability,
} from '../src/eventDomain';

describe('event domain', () => {
  it('permits only canonical lifecycle transitions', () => {
    expect(EVENT_TRANSITIONS).toEqual({
      draft: ['published', 'cancelled'],
      published: ['registration_closed', 'cancelled'],
      registration_closed: ['completed', 'cancelled'],
      completed: ['archived'],
      cancelled: ['archived'],
      archived: [],
    });
  });

  it('deeply freezes canonical lifecycle transitions', () => {
    expect(Object.isFrozen(EVENT_TRANSITIONS)).toBe(true);
    for (const transitions of Object.values(EVENT_TRANSITIONS)) {
      expect(Object.isFrozen(transitions)).toBe(true);
    }
  });

  it('normalizes legacy event update keys and removes their aliases', () => {
    expect(normalizeEventUpdate({
      end_date: '2026-09-01T12:00:00Z',
      capacity: 12,
    })).toEqual({
      event_end_date: '2026-09-01T12:00:00Z',
      total_capacity: 12,
    });
  });

  it('preserves canonical event update keys when legacy aliases collide', () => {
    expect(normalizeEventUpdate({
      event_end_date: '2026-09-01T13:00:00Z',
      end_date: '2026-09-01T12:00:00Z',
      total_capacity: 16,
      capacity: 12,
    })).toEqual({
      event_end_date: '2026-09-01T13:00:00Z',
      total_capacity: 16,
    });
  });

  it('normalizes cancellation and canonical RSVP update fields', () => {
    expect(normalizeRsvpUpdate({
      status: 'cancelled',
      cancellation_note: 'Travel',
    })).toEqual({ action: 'cancel', cancellationNote: 'Travel' });

    expect(normalizeRsvpUpdate({
      notes: 'No stairs',
      first_visit_briefed: 1,
    })).toEqual({
      action: 'update',
      notes: 'No stairs',
      firstVisitBriefed: true,
    });
  });

  it('gives cancellation precedence over stale update-only flags', () => {
    expect(normalizeRsvpUpdate({
      status: 'cancelled',
      cancellation_note: 'Travel',
      show_in_guest_list: 'false',
    })).toEqual({ action: 'cancel', cancellationNote: 'Travel' });
  });

  it('accepts boolean and numeric RSVP visibility flags without coercion', () => {
    expect(normalizeRsvpUpdate({
      first_visit_briefed: false,
      show_in_guest_list: 0,
    })).toEqual({
      action: 'update',
      firstVisitBriefed: false,
      showInGuestList: false,
    });
  });

  it.each([
    ['first_visit_briefed', 'false'],
    ['show_in_guest_list', '0'],
  ])('rejects unsupported %s values', (key, value) => {
    expect(() => normalizeRsvpUpdate({ [key]: value })).toThrowError(
      new TypeError(`${key} must be a boolean or 0/1`),
    );
  });

  it('projects only public post-session fields and safely parses JSON', () => {
    expect(publicPostSessionProjection({
      event_id: 'event-1',
      session_notes: 'Shared',
      gallery_images: '["gallery-1.jpg"]',
      host_notes: 'Private',
      host_changes: 'Private change',
      tea_ledger: '{"teas":["Rou Gui"]}',
    })).toEqual({
      event_id: 'event-1',
      session_notes: 'Shared',
      gallery_images: ['gallery-1.jpg'],
      tea_ledger: { teas: ['Rou Gui'] },
    });

    expect(publicPostSessionProjection({
      event_id: 'event-2',
      session_notes: null,
      gallery_images: 'not-json',
      tea_ledger: '{broken',
    })).toEqual({
      event_id: 'event-2',
      session_notes: null,
      gallery_images: [],
      tea_ledger: null,
    });
  });

  it('filters gallery entries and rejects wrong-shaped public JSON fields', () => {
    expect(publicPostSessionProjection({
      event_id: 'event-3',
      session_notes: 'Shared',
      gallery_images: '["gallery-1.jpg",7,null,{"url":"private"}]',
      tea_ledger: '[]',
    })).toEqual({
      event_id: 'event-3',
      session_notes: 'Shared',
      gallery_images: ['gallery-1.jpg'],
      tea_ledger: null,
    });

    expect(publicPostSessionProjection({
      event_id: 'event-4',
      gallery_images: '"gallery-1.jpg"',
      tea_ledger: '42',
    })).toEqual({
      event_id: 'event-4',
      session_notes: null,
      gallery_images: [],
      tea_ledger: null,
    });

    expect(publicPostSessionProjection({
      event_id: 'event-5',
      gallery_images: { image: 'gallery-1.jpg' },
      tea_ledger: '"ledger"',
    })).toEqual({
      event_id: 'event-5',
      session_notes: null,
      gallery_images: [],
      tea_ledger: null,
    });
  });

  it('returns held seats and nonnegative availability', () => {
    expect(seatAvailability({
      capacity: 3,
      confirmedSeats: 2,
      offeredSeats: 1,
    })).toEqual({ held: 3, available: 0 });

    expect(seatAvailability({
      capacity: 2,
      confirmedSeats: 3,
      offeredSeats: 0,
    })).toEqual({ held: 3, available: 0 });
  });

  it.each(['capacity', 'confirmedSeats', 'offeredSeats'] as const)(
    'rejects invalid %s values',
    (key) => {
      for (const value of [
        -1,
        0.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(() => seatAvailability({
          capacity: 3,
          confirmedSeats: 2,
          offeredSeats: 1,
          [key]: value,
        })).toThrow(TypeError);
      }
    },
  );
});
