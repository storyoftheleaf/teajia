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

export type PartySeatState = 'requested' | 'held' | 'confirmed';

export type PartySeatReservation = {
  id: string;
  fullName: string | null;
  isPrimary: boolean;
  sourceState: PartySeatState | null;
  targetState: PartySeatState;
  invitationId?: string | null;
  invitation?: {
    token: string;
    nameHint: string | null;
    contact: string | null;
  };
};

export type ReservePartySeatsInput = {
  accountId: string;
  eventId: string;
  participationId: string;
  sourceState: 'requested' | 'waitlist';
  targetState: 'requested' | 'confirmed';
  seats: PartySeatReservation[];
  offerExpiresAt?: string | null;
  createParticipation?: {
    columns: string[];
    values: unknown[];
  };
  guestClaim?: {
    invitationId: string;
    claimedByName: string;
    claimedByPhone: string | null;
    claimedByEmail: string | null;
  };
};

export type ReservePartySeatsResult =
  | { ok: true }
  | { ok: false; code: 'capacity_conflict' | 'event_not_reservable' | 'state_conflict' };

type SeatDatabase = Pick<D1Database, 'prepare' | 'batch'>;
type SeatEnv = { DB: SeatDatabase };

const CREATE_PARTICIPATION_COLUMNS = new Set([
  'customer_id', 'full_name', 'phone_number', 'email', 'plus_one', 'plus_one_name',
  'access_tier', 'magic_token', 'photo_consent', 'notes', 'tea_preference',
  'bringing_tea', 'guest_requests', 'contact_method', 'source', 'show_in_guest_list',
]);

function sqlPlaceholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

function capacityGuard(
  accountId: string,
  eventId: string,
  operationSeatIds: readonly string[],
  targetHeldSeats: number,
  consumedOfferParticipationIds: readonly string[],
) {
  const seatExclusion = operationSeatIds.length > 0
    ? `AND pm.id NOT IN (${sqlPlaceholders(operationSeatIds)})`
    : '';
  const offerExclusion = consumedOfferParticipationIds.length > 0
    ? `AND offer.id NOT IN (${sqlPlaceholders(consumedOfferParticipationIds)})`
    : '';
  return {
    sql: `EXISTS (
      SELECT 1 FROM events capacity_event
      WHERE capacity_event.id = ? AND capacity_event.account_id = ?
        AND capacity_event.lifecycle_status = 'published'
        AND (
          (SELECT COUNT(*) FROM event_party_members pm
           WHERE pm.event_id = capacity_event.id AND pm.account_id = capacity_event.account_id
             AND pm.seat_status IN ('held', 'confirmed') ${seatExclusion})
          + ?
          + (SELECT COUNT(*) FROM event_attendees offer
             WHERE offer.event_id = capacity_event.id AND offer.account_id = capacity_event.account_id
               AND offer.status = 'waitlist'
               AND offer.claim_expires_at IS NOT NULL
               AND datetime(offer.claim_expires_at) > datetime('now') ${offerExclusion})
        ) <= capacity_event.total_capacity
    )`,
    values: [eventId, accountId, ...operationSeatIds, targetHeldSeats, ...consumedOfferParticipationIds],
  };
}

function guestPendingGuard(input: ReservePartySeatsInput): { sql: string; values: unknown[] } {
  if (!input.guestClaim) return { sql: '1 = 1', values: [] };
  return {
    sql: `EXISTS (SELECT 1 FROM guest_invites gi
      WHERE gi.id = ? AND gi.account_id = ? AND gi.event_id = ? AND gi.status = 'pending')`,
    values: [input.guestClaim.invitationId, input.accountId, input.eventId],
  };
}

function offerGuard(input: ReservePartySeatsInput): { sql: string; values: unknown[] } {
  if (!input.offerExpiresAt) return { sql: '1 = 1', values: [] };
  return {
    sql: `EXISTS (SELECT 1 FROM event_attendees offered
      WHERE offered.id = ? AND offered.account_id = ? AND offered.event_id = ?
        AND offered.status = 'waitlist' AND offered.claim_expires_at = ?
        AND datetime(offered.claim_expires_at) > datetime('now'))`,
    values: [input.participationId, input.accountId, input.eventId, input.offerExpiresAt],
  };
}

function exactSeatGuard(input: ReservePartySeatsInput): { sql: string; values: unknown[] } {
  const clauses = input.seats.map(() =>
    `(pm.id = ? AND pm.participation_id = ? AND pm.seat_status = ?)`
  );
  return {
    sql: `(SELECT COUNT(*) FROM event_party_members pm
      WHERE pm.account_id = ? AND pm.event_id = ? AND (${clauses.join(' OR ')})) = ?`,
    values: [
      input.accountId,
      input.eventId,
      ...input.seats.flatMap((seat) => [seat.id, input.participationId, seat.targetState]),
      input.seats.length,
    ],
  };
}

/**
 * Atomically reserves one or more complete parties. D1 batch is transactional;
 * the final invalid sentinel deliberately aborts and rolls the batch back when
 * any guarded mutation did not affect the exact party requested.
 */
export async function reservePartySeats(
  env: SeatEnv,
  request: ReservePartySeatsInput | ReservePartySeatsInput[],
): Promise<ReservePartySeatsResult> {
  const operations = Array.isArray(request) ? request : [request];
  if (operations.length === 0 || operations.some((operation) => operation.seats.length === 0)) {
    return { ok: false, code: 'state_conflict' };
  }

  const { accountId, eventId } = operations[0];
  if (operations.some((operation) => operation.accountId !== accountId || operation.eventId !== eventId)) {
    return { ok: false, code: 'state_conflict' };
  }
  for (const operation of operations) {
    if (operation.createParticipation) {
      if (operation.createParticipation.columns.length !== operation.createParticipation.values.length
        || operation.createParticipation.columns.some((column) => !CREATE_PARTICIPATION_COLUMNS.has(column))) {
        return { ok: false, code: 'state_conflict' };
      }
    }
  }

  const event = await env.DB.prepare(
    `SELECT total_capacity, lifecycle_status FROM events WHERE id = ? AND account_id = ?`
  ).bind(eventId, accountId).first<{ total_capacity: number; lifecycle_status: string }>();
  if (!event || event.lifecycle_status !== 'published') {
    return { ok: false, code: 'event_not_reservable' };
  }

  const operationSeatIds = operations.flatMap((operation) => operation.seats.map((seat) => seat.id));
  if (new Set(operationSeatIds).size !== operationSeatIds.length) {
    return { ok: false, code: 'state_conflict' };
  }
  const targetHeldSeats = operations.flatMap((operation) => operation.seats)
    .filter((seat) => seat.targetState === 'held' || seat.targetState === 'confirmed').length;
  const consumedOffers = operations
    .filter((operation) => Boolean(operation.offerExpiresAt))
    .map((operation) => operation.participationId);
  const guard = capacityGuard(accountId, eventId, operationSeatIds, targetHeldSeats, consumedOffers);

  const availability = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM event_party_members pm
        WHERE pm.event_id = ? AND pm.account_id = ? AND pm.seat_status IN ('held','confirmed')
          ${operationSeatIds.length ? `AND pm.id NOT IN (${sqlPlaceholders(operationSeatIds)})` : ''}) AS accepted,
       (SELECT COUNT(*) FROM event_attendees offer
        WHERE offer.event_id = ? AND offer.account_id = ? AND offer.status = 'waitlist'
          AND offer.claim_expires_at IS NOT NULL AND datetime(offer.claim_expires_at) > datetime('now')
          ${consumedOffers.length ? `AND offer.id NOT IN (${sqlPlaceholders(consumedOffers)})` : ''}) AS offered`
  ).bind(
    eventId, accountId, ...operationSeatIds,
    eventId, accountId, ...consumedOffers,
  ).first<{ accepted: number; offered: number }>();
  if (Number(availability?.accepted || 0) + targetHeldSeats + Number(availability?.offered || 0) > event.total_capacity) {
    return { ok: false, code: 'capacity_conflict' };
  }

  const statements: D1PreparedStatement[] = [];
  for (const operation of operations) {
    const pending = guestPendingGuard(operation);
    const liveOffer = offerGuard(operation);

    if (operation.createParticipation) {
      const columns = operation.createParticipation.columns;
      const values = operation.createParticipation.values;
      statements.push(env.DB.prepare(
        `INSERT INTO event_attendees
          (id, account_id, event_id, ${columns.join(', ')}, status)
         SELECT ?, ?, ?, ${sqlPlaceholders(values)}, ?
         WHERE ${guard.sql} AND ${pending.sql} AND ${liveOffer.sql}`
      ).bind(
        operation.participationId, accountId, eventId, ...values, operation.sourceState,
        ...guard.values, ...pending.values, ...liveOffer.values,
      ));
    }

    for (const seat of operation.seats) {
      const participationSource = `EXISTS (SELECT 1 FROM event_attendees source
        WHERE source.id = ? AND source.account_id = ? AND source.event_id = ? AND source.status = ?)`;
      if (seat.sourceState === null) {
        statements.push(env.DB.prepare(
          `INSERT INTO event_party_members
            (id, account_id, event_id, participation_id, full_name, is_primary, invitation_id, seat_status)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE ${participationSource} AND ${guard.sql} AND ${pending.sql} AND ${liveOffer.sql}`
        ).bind(
          seat.id, accountId, eventId, operation.participationId, seat.fullName,
          seat.isPrimary ? 1 : 0, seat.invitationId ?? null, seat.targetState,
          operation.participationId, accountId, eventId, operation.sourceState,
          ...guard.values, ...pending.values, ...liveOffer.values,
        ));
      } else {
        statements.push(env.DB.prepare(
          `UPDATE event_party_members
           SET participation_id = ?, full_name = ?, is_primary = ?, invitation_id = ?, seat_status = ?
           WHERE id = ? AND account_id = ? AND event_id = ? AND seat_status = ?
             AND ${participationSource} AND ${guard.sql} AND ${pending.sql} AND ${liveOffer.sql}`
        ).bind(
          operation.participationId, seat.fullName, seat.isPrimary ? 1 : 0,
          seat.invitationId ?? null, seat.targetState,
          seat.id, accountId, eventId, seat.sourceState,
          operation.participationId, accountId, eventId, operation.sourceState,
          ...guard.values, ...pending.values, ...liveOffer.values,
        ));
      }

      if (seat.invitation) {
        statements.push(env.DB.prepare(
          `INSERT INTO guest_invites
            (id, account_id, event_id, parent_attendee_id, invite_token, name_hint, contact, status)
           SELECT ?, ?, ?, ?, ?, ?, ?, 'pending'
           WHERE EXISTS (SELECT 1 FROM event_party_members pm
             WHERE pm.id = ? AND pm.account_id = ? AND pm.event_id = ?
               AND pm.participation_id = ? AND pm.invitation_id = ? AND pm.seat_status = 'held')`
        ).bind(
          seat.invitationId, accountId, eventId, operation.participationId,
          seat.invitation.token, seat.invitation.nameHint, seat.invitation.contact,
          seat.id, accountId, eventId, operation.participationId, seat.invitationId,
        ));
      }
    }

    const exactSeats = exactSeatGuard(operation);
    if (operation.guestClaim) {
      statements.push(env.DB.prepare(
        `UPDATE guest_invites
         SET status = 'claimed', claimed_by_name = ?, claimed_by_phone = ?, claimed_by_email = ?,
             claimed_attendee_id = ?, claimed_at = datetime('now')
         WHERE id = ? AND account_id = ? AND event_id = ? AND status = 'pending'
           AND ${exactSeats.sql}`
      ).bind(
        operation.guestClaim.claimedByName,
        operation.guestClaim.claimedByPhone,
        operation.guestClaim.claimedByEmail,
        operation.participationId,
        operation.guestClaim.invitationId,
        accountId,
        eventId,
        ...exactSeats.values,
      ));
    }

    const guestClaimed = operation.guestClaim
      ? `AND EXISTS (SELECT 1 FROM guest_invites gi
          WHERE gi.id = ? AND gi.account_id = ? AND gi.event_id = ?
            AND gi.status = 'claimed' AND gi.claimed_attendee_id = ?)`
      : '';
    statements.push(env.DB.prepare(
      `UPDATE event_attendees
       SET status = ?${operation.offerExpiresAt ? ", claimed_at = datetime('now'), claim_expires_at = NULL" : ''}
       WHERE id = ? AND account_id = ? AND event_id = ? AND status = ?
         AND ${exactSeats.sql} ${guestClaimed}`
    ).bind(
      operation.targetState,
      operation.participationId,
      accountId,
      eventId,
      operation.sourceState,
      ...exactSeats.values,
      ...(operation.guestClaim
        ? [operation.guestClaim.invitationId, accountId, eventId, operation.participationId]
        : []),
    ));
  }

  const successClauses: string[] = [];
  const successValues: unknown[] = [];
  for (const operation of operations) {
    const exactSeats = exactSeatGuard(operation);
    successClauses.push(`(
      EXISTS (SELECT 1 FROM event_attendees final_attendee
        WHERE final_attendee.id = ? AND final_attendee.account_id = ?
          AND final_attendee.event_id = ? AND final_attendee.status = ?)
      AND ${exactSeats.sql}
      ${operation.guestClaim ? `AND EXISTS (SELECT 1 FROM guest_invites final_invite
        WHERE final_invite.id = ? AND final_invite.account_id = ? AND final_invite.event_id = ?
          AND final_invite.status = 'claimed' AND final_invite.claimed_attendee_id = ?)` : ''}
    )`);
    successValues.push(
      operation.participationId, accountId, eventId, operation.targetState,
      ...exactSeats.values,
      ...(operation.guestClaim
        ? [operation.guestClaim.invitationId, accountId, eventId, operation.participationId]
        : []),
    );
  }

  statements.push(env.DB.prepare(
    `INSERT INTO event_party_members
      (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
     SELECT ?, ?, ?, ?, 'reservation rollback sentinel', 0, 'capacity_conflict'
     WHERE NOT (${successClauses.join(' AND ')})`
  ).bind(
    `capacity-conflict-${crypto.randomUUID()}`,
    accountId,
    eventId,
    operations[0].participationId,
    ...successValues,
  ));

  try {
    const results = await env.DB.batch(statements);
    const coreResults = results.slice(0, -1);
    if (coreResults.some((result) => Number(result.meta?.changes || 0) !== 1)
      || Number(results.at(-1)?.meta?.changes || 0) !== 0) {
      return { ok: false, code: 'state_conflict' };
    }
    return { ok: true };
  } catch (error) {
    const latest = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM event_party_members pm
         WHERE pm.event_id = ? AND pm.account_id = ? AND pm.seat_status IN ('held','confirmed')) AS accepted,
        (SELECT COUNT(*) FROM event_attendees offer
         WHERE offer.event_id = ? AND offer.account_id = ? AND offer.status = 'waitlist'
           AND offer.claim_expires_at IS NOT NULL AND datetime(offer.claim_expires_at) > datetime('now')) AS offered`
    ).bind(eventId, accountId, eventId, accountId).first<{ accepted: number; offered: number }>();
    if (Number(latest?.accepted || 0) + Number(latest?.offered || 0) + targetHeldSeats > event.total_capacity) {
      return { ok: false, code: 'capacity_conflict' };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('capacity_conflict') || message.includes('seat_status')) {
      return { ok: false, code: 'state_conflict' };
    }
    throw error;
  }
}
