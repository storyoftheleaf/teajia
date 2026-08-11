export type EventLifecycle =
  | 'draft'
  | 'published'
  | 'registration_closed'
  | 'completed'
  | 'cancelled'
  | 'archived';

export const EVENT_TRANSITIONS: Readonly<Record<EventLifecycle, readonly EventLifecycle[]>> =
  Object.freeze({
    draft: Object.freeze(['published', 'cancelled']),
    published: Object.freeze(['registration_closed', 'cancelled']),
    registration_closed: Object.freeze(['completed', 'cancelled']),
    completed: Object.freeze(['archived']),
    cancelled: Object.freeze(['archived']),
    archived: Object.freeze([]),
  });

export function normalizeEventUpdate(input: Record<string, unknown>): Record<string, unknown> {
  const result = { ...input };

  if ('end_date' in result) {
    if (!('event_end_date' in result)) result.event_end_date = result.end_date;
    delete result.end_date;
  }

  if ('capacity' in result) {
    if (!('total_capacity' in result)) result.total_capacity = result.capacity;
    delete result.capacity;
  }

  return result;
}

function normalizeRsvpFlag(name: string, value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  throw new TypeError(`${name} must be a boolean or 0/1`);
}

export function normalizeRsvpUpdate(input: Record<string, unknown>) {
  if (input.cancel === true || input.status === 'cancelled') {
    return {
      action: 'cancel' as const,
      cancellationNote: String(input.cancellation_note || '') || undefined,
    };
  }

  const firstVisitBriefed = 'first_visit_briefed' in input
    ? normalizeRsvpFlag('first_visit_briefed', input.first_visit_briefed)
    : undefined;
  const showInGuestList = 'show_in_guest_list' in input
    ? normalizeRsvpFlag('show_in_guest_list', input.show_in_guest_list)
    : undefined;

  return {
    action: 'update' as const,
    ...('notes' in input ? { notes: String(input.notes || '') || null } : {}),
    ...(firstVisitBriefed !== undefined ? { firstVisitBriefed } : {}),
    ...(showInGuestList !== undefined ? { showInGuestList } : {}),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseStringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function parseTeaLedger(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

export function publicPostSessionProjection(row: Record<string, unknown>) {
  return {
    event_id: row.event_id,
    session_notes: row.session_notes ?? null,
    gallery_images: parseStringArray(row.gallery_images),
    tea_ledger: parseTeaLedger(row.tea_ledger),
    shared_tasting_notes: parseStringArray(row.shared_tasting_notes),
  };
}

function requireSeatCount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

export function seatAvailability(input: {
  capacity: number;
  confirmedSeats: number;
  offeredSeats: number;
}): { held: number; available: number } {
  requireSeatCount('capacity', input.capacity);
  requireSeatCount('confirmedSeats', input.confirmedSeats);
  requireSeatCount('offeredSeats', input.offeredSeats);

  const held = input.confirmedSeats + input.offeredSeats;
  return {
    held,
    available: Math.max(0, input.capacity - held),
  };
}
