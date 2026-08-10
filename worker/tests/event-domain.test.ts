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

  it('normalizes legacy event update keys and removes their aliases', () => {
    expect(normalizeEventUpdate({
      end_date: '2026-09-01T12:00:00Z',
      capacity: 12,
    })).toEqual({
      event_end_date: '2026-09-01T12:00:00Z',
      total_capacity: 12,
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
});
