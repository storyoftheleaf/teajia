/**
 * Circles and series (Launch 5, M4; todo/plans/guests-and-tea-masters-launch-5-run.md).
 *
 * A circle is a named table that meets again; a series is several sessions
 * under one name. Both are one row of session_series, owned by one host in
 * their own personal account, and a session belongs to at most one of them
 * through events.series_id.
 *
 * The rules, each held here and nowhere else:
 * - Two switches stand together: CIRCLES_OPEN and Launch 2's FEW_HOSTS_OPEN
 *   (src/lib/circles.ts). Closed, every route answers 404 and every other
 *   answer is exactly as before.
 * - A host acts only on their own circles and their own tables (the same
 *   ownership ownHostedTable uses). Anything else is "not found".
 * - A stopped host makes nothing new: no circle, no table put in, no guest
 *   asked back. Taking a table out is still theirs to do.
 * - Asking a guest back gives no new seat rule. It is the host's yes: the
 *   guarded allocator (reservePartySeats) takes the seat, so a full or closed
 *   table refuses at the moment of the write. Only a guest confirmed at an
 *   earlier table of the same circle may be asked.
 * - Nothing is sent, to anyone, ever. There are no reminders.
 * - No answer carries an address, a count of meetings, or how often anyone
 *   came. A guest is their name and nothing more.
 */
import { anyoneMayHost, hostDoorsFor, hostStanding } from './hostApproval';
import { reservePartySeats } from './eventDomain';
import { ownHostedTable, type OwnHostedTable } from './hostTableGuests';
import { photoConsentValue } from './seatRequest';
import { circlesOpen, SERIES_NAME_MAX, type CircleGuest, type HostSeries, type PublicSeries, type SeriesKind, type SeriesTable } from '../../src/lib/circles';

export type CirclesEnv = { DB: D1Database; CIRCLES_OPEN?: string; FEW_HOSTS_OPEN?: string; ANYONE_HOSTS_OPEN?: string };

/** The caller as a host of circles: their own active personal account, and whether Teajia stopped them. */
export type CircleHost = { userId: string; accountId: string; stopped: boolean };

export type CircleRefusal = { refused: { status: number; code: string; error: string } };

const refuse = (status: number, code: string, error: string): CircleRefusal => ({ refused: { status, code, error } });
const NOT_FOUND = refuse(404, 'not_found', 'Not found');
const TABLE_NOT_FOUND = refuse(404, 'table_not_found', 'Table not found');
const CIRCLE_NOT_FOUND = refuse(404, 'circle_not_found', 'Circle not found');
const STOPPED = refuse(403, 'hosting_stopped', 'New tables are paused on your account. Write to Teajia to talk it over.');

/**
 * The caller, when circles are open and they may host: the token or session
 * is theirs, on their own active personal account, and they may host now or
 * were stopped after hosting (they keep reading what they made). Null otherwise.
 */
export async function circleHost(env: CirclesEnv, userId: string, accountId?: string): Promise<CircleHost | null> {
  if (!circlesOpen(env) || !userId) return null;
  const account = await env.DB.prepare(
    `SELECT id FROM accounts WHERE personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id
       AND status = 'active'${accountId ? ' AND id = ?' : ''}`,
  ).bind(userId, ...(accountId ? [accountId] : [])).first<{ id: string }>();
  if (!account) return null;
  const standing = await hostStanding(env.DB, userId);
  if (!hostDoorsFor(standing, anyoneMayHost(env)) && !standing.stopped) return null;
  return { userId, accountId: account.id, stopped: standing.stopped };
}

/** One of the host's own tables, in their own account, or null. */
export async function circleTable(db: D1Database, host: CircleHost, tableId: unknown): Promise<OwnHostedTable | null> {
  const id = typeof tableId === 'string' ? tableId.trim() : '';
  if (!id) return null;
  const table = await ownHostedTable(db, { hostUserId: host.userId, eventId: id });
  return table && table.account_id === host.accountId ? table : null;
}

type SeriesRow = { id: string; name: string; kind: SeriesKind; created_at: string };

async function ownSeries(db: D1Database, host: CircleHost, seriesId: unknown): Promise<SeriesRow | null> {
  const id = typeof seriesId === 'string' ? seriesId.trim() : '';
  if (!id) return null;
  return db.prepare(
    'SELECT id, name, kind, created_at FROM session_series WHERE id = ? AND account_id = ? AND host_user_id = ?',
  ).bind(id, host.accountId, host.userId).first<SeriesRow>();
}

/** A name and kind as the host gave them, or a refusal. */
export function readSeriesInput(body: Record<string, unknown> | null | undefined): { name: string; kind: SeriesKind } | CircleRefusal {
  const kind = body?.kind;
  if (kind !== 'circle' && kind !== 'series') return refuse(400, 'series_kind', 'Choose a circle or a series.');
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return refuse(400, 'series_name', 'Give it a name.');
  if (name.length > SERIES_NAME_MAX) return refuse(400, 'series_name', `Keep the name under ${SERIES_NAME_MAX} characters.`);
  return { name, kind };
}

/** The host's own circles and series, newest first, each with its tables in time order. */
export async function listHostSeries(db: D1Database, host: CircleHost): Promise<HostSeries[]> {
  const [series, tables] = await Promise.all([
    db.prepare(
      `SELECT id, name, kind, created_at FROM session_series WHERE account_id = ? AND host_user_id = ?
        ORDER BY created_at DESC, id DESC LIMIT 100`,
    ).bind(host.accountId, host.userId).all<SeriesRow>(),
    db.prepare(
      `SELECT e.id, e.title, e.event_date, e.timezone, e.lifecycle_status, e.series_id
         FROM events e JOIN session_series s ON s.id = e.series_id AND s.account_id = e.account_id AND s.host_user_id = e.host_user_id
        WHERE e.account_id = ? AND e.host_user_id = ?
        ORDER BY e.event_date ASC, e.id ASC`,
    ).bind(host.accountId, host.userId).all<SeriesTable & { series_id: string }>(),
  ]);
  return series.results.map(row => ({
    id: row.id, name: row.name, kind: row.kind, created_at: row.created_at,
    tables: tables.results.filter(table => table.series_id === row.id)
      .map(({ series_id: _series, ...table }) => table),
  }));
}

/** Make a circle or series. A stopped host makes nothing new. */
export async function makeSeries(db: D1Database, host: CircleHost, input: { name: string; kind: SeriesKind }): Promise<HostSeries | CircleRefusal> {
  if (host.stopped) return STOPPED;
  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO session_series (id, account_id, host_user_id, name, kind) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, host.accountId, host.userId, input.name, input.kind).run();
  const row = await ownSeries(db, host, id);
  return { id, name: input.name, kind: input.kind, created_at: row?.created_at ?? new Date().toISOString(), tables: [] };
}

/**
 * Put one of the host's own tables in one of their own circles, or take it
 * out (seriesId null). Putting in is something new, so a stopped host may not;
 * taking out is always theirs.
 */
export async function placeTable(
  db: D1Database, host: CircleHost, tableId: unknown, seriesId: string | null, preview = false,
): Promise<{ table_id: string; series: { id: string; name: string; kind: SeriesKind } | null } | CircleRefusal> {
  const table = await circleTable(db, host, tableId);
  if (!table) return TABLE_NOT_FOUND;
  let series: SeriesRow | null = null;
  if (seriesId !== null) {
    if (host.stopped) return STOPPED;
    series = await ownSeries(db, host, seriesId);
    if (!series) return CIRCLE_NOT_FOUND;
  }
  if (!preview) {
    await db.prepare('UPDATE events SET series_id = ? WHERE id = ? AND account_id = ? AND host_user_id = ?')
      .bind(series?.id ?? null, table.id, host.accountId, host.userId).run();
  }
  return { table_id: table.id, series: series ? { id: series.id, name: series.name, kind: series.kind } : null };
}

type GuestRow = {
  id: string; full_name: string; user_id: string | null; phone_number: string | null; email: string | null;
  photo_consent: number | null; customer_id: string | null; event_date: string;
};

/** The circle a table sits in, when it is one of the host's circles (not a series). */
async function tableCircle(db: D1Database, table: OwnHostedTable): Promise<SeriesRow | null> {
  return db.prepare(
    `SELECT s.id, s.name, s.kind, s.created_at FROM events e
       JOIN session_series s ON s.id = e.series_id AND s.account_id = e.account_id AND s.host_user_id = e.host_user_id
      WHERE e.id = ? AND e.account_id = ? AND s.kind = 'circle'`,
  ).bind(table.id, table.account_id).first<SeriesRow>();
}

const sameGuest = (a: Pick<GuestRow, 'user_id' | 'phone_number' | 'email'>, b: Pick<GuestRow, 'user_id' | 'phone_number' | 'email'>) =>
  Boolean((a.user_id && a.user_id === b.user_id) || (a.phone_number && a.phone_number === b.phone_number)
    || (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()));

/**
 * The guests confirmed at an earlier table of this table's circle who have no
 * row at this table yet, one entry each (their latest seat), by name. Empty
 * when the table is in no circle. Only the host's own tables are read.
 */
async function pastCircleSeats(db: D1Database, table: OwnHostedTable): Promise<{ circle: SeriesRow | null; seats: GuestRow[] }> {
  const circle = await tableCircle(db, table);
  if (!circle) return { circle: null, seats: [] };
  const [earlier, here] = await Promise.all([
    db.prepare(
      `SELECT ea.id, ea.full_name, ea.user_id, ea.phone_number, ea.email, ea.photo_consent, ea.customer_id, past.event_date
         FROM event_attendees ea
         JOIN events past ON past.id = ea.event_id AND past.account_id = ea.account_id
         JOIN events this_table ON this_table.id = ? AND this_table.account_id = ?
        WHERE past.series_id = ? AND past.account_id = ? AND past.host_user_id = this_table.host_user_id
          AND past.id <> this_table.id
          AND datetime(past.event_date) < datetime(this_table.event_date)
          AND ea.status = 'confirmed'
        ORDER BY past.event_date DESC, ea.created_at DESC, ea.id ASC`,
    ).bind(table.id, table.account_id, circle.id, table.account_id).all<GuestRow>(),
    db.prepare('SELECT user_id, phone_number, email FROM event_attendees WHERE event_id = ? AND account_id = ?')
      .bind(table.id, table.account_id).all<Pick<GuestRow, 'user_id' | 'phone_number' | 'email'>>(),
  ]);
  const seats: GuestRow[] = [];
  for (const seat of earlier.results) {
    if (here.results.some(row => sameGuest(row, seat))) continue;
    if (seats.some(row => sameGuest(row, seat) || (row.id === seat.id))) continue;
    // A guest who left no contact is known by their name within the circle.
    if (!seat.user_id && !seat.phone_number && !seat.email
      && seats.some(row => !row.user_id && !row.phone_number && !row.email && row.full_name.trim().toLowerCase() === seat.full_name.trim().toLowerCase())) continue;
    seats.push(seat);
  }
  return { circle, seats };
}

/** For the host: the circle this table is in, and the earlier guests they may ask back. Names only. */
export async function circleGuests(db: D1Database, table: OwnHostedTable): Promise<{ circle: { id: string; name: string } | null; guests: CircleGuest[] }> {
  const { circle, seats } = await pastCircleSeats(db, table);
  return {
    circle: circle ? { id: circle.id, name: circle.name } : null,
    guests: seats.map(seat => ({ attendee_id: seat.id, name: seat.full_name })),
  };
}

/**
 * Ask a guest of an earlier table in the circle to this one, in one tap. It
 * is the host's yes, taken through the guarded allocator: one seat, for the
 * guest alone, refused when the table is full, closed or already over.
 * Nothing is sent; the host tells the guest themselves.
 */
export async function askBack(
  env: CirclesEnv, host: CircleHost, table: OwnHostedTable, attendeeId: unknown, preview = false,
): Promise<{ attendee_id: string; name: string; status: 'confirmed' } | CircleRefusal> {
  if (host.stopped) return STOPPED;
  const { seats } = await pastCircleSeats(env.DB, table);
  const seat = seats.find(row => row.id === attendeeId);
  if (!seat) return refuse(404, 'guest_not_found', 'Guest not found');
  if (table.lifecycle_status !== 'published') return refuse(409, 'event_not_reservable', 'This table is not taking guests.');
  if (preview) return { attendee_id: seat.id, name: seat.full_name, status: 'confirmed' };
  const participationId = crypto.randomUUID();
  const reserved = await reservePartySeats(env, {
    accountId: table.account_id,
    eventId: table.id,
    participationId,
    sourceState: 'requested',
    targetState: 'confirmed',
    seats: [{ id: crypto.randomUUID(), fullName: seat.full_name, isPrimary: true, sourceState: null, targetState: 'confirmed' }],
    createParticipation: {
      columns: ['customer_id', 'full_name', 'phone_number', 'email', 'plus_one', 'magic_token', 'photo_consent',
        'contact_method', 'source', 'show_in_guest_list', 'user_id'],
      values: [seat.customer_id, seat.full_name, seat.phone_number, seat.email, 0, crypto.randomUUID(),
        // The guest's own wish about photographs travels with them; NULL when they said nothing.
        photoConsentValue(seat.photo_consent),
        'whatsapp', 'direct', 0, seat.user_id],
    },
  });
  if (!reserved.ok) {
    if (reserved.code === 'capacity_conflict') return refuse(409, 'capacity_conflict', 'The table is full. Add a seat first.');
    if (reserved.code === 'event_not_reservable') return refuse(409, 'event_not_reservable', 'This table is not taking guests.');
    if (reserved.code === 'already_seated') return refuse(409, 'already_seated', 'This guest already has a seat at this table.');
    return refuse(409, 'state_conflict', 'The table changed while you were looking. Open it again.');
  }
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'attendee_approved', ?, NULL, 'event_attendee', ?, ?)`,
  ).bind(crypto.randomUUID(), `Host asked ${seat.full_name} back from their circle`, participationId, table.account_id).run();
  return { attendee_id: participationId, name: seat.full_name, status: 'confirmed' };
}

/**
 * "Same table again" on a table in a circle or series puts the copy in the
 * same one. Read by duplicateEvent; null while circles are closed, so the
 * copy is exactly as before.
 */
export function seriesForCopy(env: CirclesEnv, source: Record<string, unknown>): string | null {
  if (!circlesOpen(env) || !source.host_user_id) return null;
  return typeof source.series_id === 'string' && source.series_id ? source.series_id : null;
}

/**
 * What a session's public page says of its circle or series: the name, and
 * for a series, its other sessions anyone may find, by name, day and link.
 * Never an address, never a count. `listed` is the SQL (aliases e and a)
 * that says a session may be found by the public.
 */
export async function publicSeries(env: CirclesEnv, event: { id: unknown; account_id: unknown }, listed: string): Promise<PublicSeries | null> {
  if (!circlesOpen(env)) return null;
  const series = await env.DB.prepare(
    `SELECT s.id, s.name, s.kind FROM events e
       JOIN session_series s ON s.id = e.series_id AND s.account_id = e.account_id AND s.host_user_id = e.host_user_id
      WHERE e.id = ? AND e.account_id = ?`,
  ).bind(event.id, event.account_id).first<{ id: string; name: string; kind: SeriesKind }>();
  if (!series) return null;
  if (series.kind !== 'series') return { name: series.name, kind: series.kind, others: [] };
  const { results } = await env.DB.prepare(
    `SELECT e.slug, e.title, e.event_date FROM events e JOIN accounts a ON a.id = e.account_id
      WHERE e.series_id = ? AND e.account_id = ? AND e.id <> ? AND e.status = 'active'
        AND e.lifecycle_status IN ('published', 'completed') AND ${listed}
      ORDER BY e.event_date ASC, e.id ASC LIMIT 12`,
  ).bind(series.id, event.account_id, event.id).all<{ slug: string; title: string; event_date: string }>();
  return { name: series.name, kind: series.kind, others: results };
}

// ── Routes ──────────────────────────────────────────────────────────────────

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

export interface CirclesDeps<E> {
  requireAuthenticatedUser(request: Request, env: E): Promise<{ userId: string } | { error: Response }>;
}

function answer(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
const refusalAnswer = ({ refused }: CircleRefusal) => answer({ error: refused.error, code: refused.code }, refused.status);

/**
 * GET  /api/me/circles                                   the host's circles and series
 * POST /api/me/circles {name, kind}                      make one
 * PUT  /api/me/tables/:id/circle {circle_id | null}      put a table in, or take it out
 * GET  /api/me/tables/:id/circle-guests                  earlier guests of the table's circle
 * POST /api/me/tables/:id/circle-guests/:attendeeId/ask  ask one back, as the host's yes
 */
export function circlesRoutes<E extends CirclesEnv>(deps: CirclesDeps<E>): [string, string, Handler<E>][] {
  const hostFor = async (request: Request, env: E): Promise<CircleHost | { error: Response }> => {
    if (!circlesOpen(env)) return { error: refusalAnswer(NOT_FOUND) };
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person;
    return (await circleHost(env, person.userId)) ?? { error: refusalAnswer(NOT_FOUND) };
  };
  const body = async (request: Request) => await request.json().catch(() => null) as Record<string, unknown> | null;

  const list: Handler<E> = async (request, env) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    return answer({ circles: await listHostSeries(env.DB, host) });
  };
  const make: Handler<E> = async (request, env) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const input = readSeriesInput(await body(request));
    if ('refused' in input) return refusalAnswer(input);
    const made = await makeSeries(env.DB, host, input);
    return 'refused' in made ? refusalAnswer(made) : answer({ circle: made }, 201);
  };
  const place: Handler<E> = async (request, env, params) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const input = await body(request);
    const seriesId = input?.circle_id === null ? null : typeof input?.circle_id === 'string' ? input.circle_id : undefined;
    if (seriesId === undefined) return answer({ error: 'Choose a circle, or none.', code: 'circle_id' }, 400);
    const placed = await placeTable(env.DB, host, params.id, seriesId);
    return 'refused' in placed ? refusalAnswer(placed) : answer({ ok: true, ...placed });
  };
  const guests: Handler<E> = async (request, env, params) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const table = await circleTable(env.DB, host, params.id);
    if (!table) return refusalAnswer(TABLE_NOT_FOUND);
    return answer(await circleGuests(env.DB, table));
  };
  const ask: Handler<E> = async (request, env, params) => {
    const host = await hostFor(request, env);
    if ('error' in host) return host.error;
    const table = await circleTable(env.DB, host, params.id);
    if (!table) return refusalAnswer(TABLE_NOT_FOUND);
    const asked = await askBack(env, host, table, params.attendeeId);
    return 'refused' in asked ? refusalAnswer(asked) : answer({ ok: true, ...asked });
  };

  return [
    ['GET', '/api/me/circles', list],
    ['POST', '/api/me/circles', make],
    ['PUT', '/api/me/tables/:id/circle', place],
    ['GET', '/api/me/tables/:id/circle-guests', guests],
    ['POST', '/api/me/tables/:id/circle-guests/:attendeeId/ask', ask],
  ];
}
