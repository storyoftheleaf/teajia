export type EventLifecycle =
  | 'draft'
  | 'published'
  | 'registration_closed'
  | 'completed'
  | 'cancelled'
  | 'archived';

export const EVENT_TRANSITIONS: Record<EventLifecycle, EventLifecycle[]> = {
  draft: ['published', 'cancelled'],
  published: ['registration_closed', 'cancelled'],
  registration_closed: ['completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

export function normalizeEventUpdate(input: Record<string, unknown>): Record<string, unknown> {
  const result = { ...input };

  if ('end_date' in result) {
    result.event_end_date = result.end_date;
    delete result.end_date;
  }

  if ('capacity' in result) {
    result.total_capacity = result.capacity;
    delete result.capacity;
  }

  return result;
}

export function normalizeRsvpUpdate(input: Record<string, unknown>) {
  if (input.cancel === true || input.status === 'cancelled') {
    return {
      action: 'cancel' as const,
      cancellationNote: String(input.cancellation_note || '') || undefined,
    };
  }

  return {
    action: 'update' as const,
    ...('notes' in input ? { notes: String(input.notes || '') || null } : {}),
    ...('first_visit_briefed' in input
      ? { firstVisitBriefed: Boolean(input.first_visit_briefed) }
      : {}),
    ...('show_in_guest_list' in input
      ? { showInGuestList: Boolean(input.show_in_guest_list) }
      : {}),
  };
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return value ?? fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function publicPostSessionProjection(row: Record<string, unknown>) {
  return {
    event_id: row.event_id,
    session_notes: row.session_notes ?? null,
    gallery_images: parseJson(row.gallery_images, []),
    tea_ledger: parseJson(row.tea_ledger, null),
  };
}

export function seatAvailability(input: {
  capacity: number;
  confirmedSeats: number;
  offeredSeats: number;
}): { held: number; available: number } {
  const held = input.confirmedSeats + input.offeredSeats;
  return {
    held,
    available: Math.max(0, input.capacity - held),
  };
}
