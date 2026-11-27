import { serveGuestBook } from './sessionGuestBook';
import {
  reviewGuestBookPhotos, saveGuestBookEntryWithPhoto, serveGuestBookPhotos, serveOwnerGuestBookPhoto,
  serveSessionGallery, withdrawGuestBookEntry, type GuestBookPhotoInput,
} from './sessionGuestBookPhotos';
import { afterSitCredentialFormat, createAfterSitCredential, hashAfterSitCredential } from './afterSitCredential';
import { getKeptSetup, namedSetupTeas, saveKeptSetup } from './privateKeptSetups';
import { eraseKeptSetup } from './privateKeptSetupPhotos';
import { findPartyLink, findPartyRecap, issuePartyLink, revokePartyLinks, servePartyGuestBook } from './afterSitPartyLinks';
import { servedTeasOf } from './publicSessions';
import type { PublicProductReader } from './sessionTeas';
import { readableArticleFor } from './eventDomain';
import { firstTableOpen } from '../../src/lib/firstTable';
import { anyoneHostsOpen } from '../../src/lib/anyoneHosts';
import { keptSessionTeaIds, keepSessionTea } from './chestKeep';
import { journalTeasOf } from './sessionTasting';

type AfterSitEnv = { DB: D1Database; ATLAS_BUCKET?: R2Bucket; FIRST_TABLE_OPEN?: string; ANYONE_HOSTS_OPEN?: string };
type LinkInput = GuestBookPhotoInput & { credential?: unknown; note?: unknown; photo?: unknown; teaId?: unknown; publicRecap?: unknown };
const guestBookPhotoActions = new Set<unknown>(['photos-read', 'photo-bytes', 'private-photo-preview', 'photo-offer', 'photo-withdraw']);
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Authorization<E, Scope> = (request: Request, env: E) => Promise<Scope | { error: Response }>;

type Deps<E> = {
  requireHost: Authorization<E, { accountId: string }>;
  requireUser: Authorization<E, { userId: string }>;
  limit: (request: Request, env: E, key: string) => Promise<Response | null>;
  /** The shop's public product reader, for each poured tea's page (Launch 1). */
  readPublic?: (env: E) => PublicProductReader;
  /** The signed-in caller when the request carries a valid sign-in, else null. Never refuses. */
  optionalUser?: (request: Request, env: E) => Promise<string | null>;
};

type RecapTea = { id: string; name: string; path?: string | null; kept?: boolean };

/** A short random reference for a session's thank-you links. Never a guest's secret. */
function newThanksRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function thanksRefFor(db: D1Database, eventId: string, accountId: string) {
  await db.prepare(`UPDATE events SET thanks_ref = ? WHERE id = ? AND account_id = ? AND thanks_ref IS NULL`)
    .bind(newThanksRef(), eventId, accountId).run();
  const row = await db.prepare(`SELECT thanks_ref FROM events WHERE id = ? AND account_id = ?`)
    .bind(eventId, accountId).first<{ thanks_ref: string | null }>();
  return row?.thanks_ref ?? null;
}

const LINK_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
const guestSeat = `
  a.status = 'confirmed' AND a.attended = 1
  AND e.lifecycle_status IN ('completed', 'archived') AND shop.status = 'active'`;
const eventJoins = `
  JOIN events e ON e.id = a.event_id AND e.account_id = a.account_id
  JOIN accounts shop ON shop.id = a.account_id`;

function privateResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

const json = (value: unknown, status = 200) => privateResponse(Response.json(value, { status }));
const unavailable = () => json({ error: 'This after-sit link is unavailable.' }, 404);

export function findEligibleSeat(db: D1Database, credentialHash: string) {
  return db.prepare(
    `SELECT e.id, e.title, e.event_date, a.account_id, s.session_notes AS host_note,
        (SELECT json_group_array(json_object('id', tea.id, 'name', tea.name))
          FROM (${namedSetupTeas}) AS tea) AS teas_json
     FROM after_sit_live_access l
     JOIN event_attendees a
       ON a.id = l.attendee_id AND a.event_id = l.event_id AND a.account_id = l.account_id
     ${eventJoins}
     LEFT JOIN event_attendee_recaps s ON s.event_id = a.event_id AND s.account_id = a.account_id
     WHERE l.credential_hash = ? AND l.expires_at > unixepoch() AND ${guestSeat}`,
  ).bind(credentialHash).first<{
    id: string; title: string; event_date: string; account_id: string; host_note: string | null; teas_json: string;
  }>();
}

/**
 * Issue one after-sit (thank-you) link for a guest who came to a finished
 * session, or null when the seat is not eligible. Used by the shop's own route
 * below and by a small host's route for their own table (Launch 2, H4); the
 * caller has already proved the session is theirs.
 */
export async function issueAfterSitLink(db: D1Database, { attendeeId, eventId, accountId }: {
  attendeeId: string; eventId: string; accountId: string;
}): Promise<{ credential: string; expires_at: string } | null> {
  const scope = [attendeeId, eventId, accountId];
  const credential = createAfterSitCredential();
  const hash = await hashAfterSitCredential(credential);
  const expiresAt = Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS;
  // The first link for a seat takes the main slot (or replaces one that has
  // expired); a later copy is added beside it, so a link the guest already
  // has keeps working until it expires.
  const eligible = `SELECT a.id, a.event_id, a.account_id, ?, ? FROM event_attendees a
     ${eventJoins}
     WHERE a.id = ? AND a.event_id = ? AND a.account_id = ? AND ${guestSeat}`;
  const [, first, extra] = await db.batch([
    db.prepare(`DELETE FROM after_sit_extra_access WHERE attendee_id = ? AND event_id = ? AND account_id = ?
      AND expires_at <= unixepoch()`).bind(...scope),
    db.prepare(`INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at)
     ${eligible}
     ON CONFLICT(attendee_id, event_id, account_id) DO UPDATE SET
       credential_hash = excluded.credential_hash, expires_at = excluded.expires_at
     WHERE after_sit_access.expires_at <= unixepoch()`).bind(hash, expiresAt, ...scope),
    db.prepare(`INSERT INTO after_sit_extra_access (attendee_id, event_id, account_id, credential_hash, expires_at)
     ${eligible} AND NOT EXISTS (SELECT 1 FROM after_sit_access held WHERE held.credential_hash = ?)`)
      .bind(hash, expiresAt, ...scope, hash),
  ]);
  return first.meta?.changes || extra.meta?.changes
    ? { credential, expires_at: new Date(expiresAt * 1000).toISOString() } : null;
}

export function afterSitRoutes<E extends AfterSitEnv>(deps: Deps<E>): [string, string, Handler<E>][] {
  const manage: Handler<E> = async (request, env, { eventId, attendeeId }) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return privateResponse(host.error);
    const limited = await deps.limit(request, env, `host:${host.accountId}`);
    if (limited) return privateResponse(limited);

    const scope = [attendeeId, eventId, host.accountId];
    if (request.method === 'DELETE') {
      const [first, extra, party] = await env.DB.batch([
        env.DB.prepare(`DELETE FROM after_sit_access WHERE attendee_id = ? AND event_id = ? AND account_id = ?`).bind(...scope),
        env.DB.prepare(`DELETE FROM after_sit_extra_access WHERE attendee_id = ? AND event_id = ? AND account_id = ?`).bind(...scope),
        revokePartyLinks(env.DB, attendeeId, eventId, host.accountId),
      ]);
      return first.meta?.changes || extra.meta?.changes || party.meta?.changes ? json({ revoked: true }) : unavailable();
    }

    const issued = await issueAfterSitLink(env.DB, { attendeeId, eventId, accountId: host.accountId });
    return issued ? json(issued) : unavailable();
  };

  function withLink(run: (request: Request, env: E, credentialHash: string, body: LinkInput) => Promise<Response>): Handler<E> {
    return async (request, env) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipLimited = await deps.limit(request, env, `ip:${ip}`);
      if (ipLimited) return privateResponse(ipLimited);
      const body = await request.json().catch(() => null) as LinkInput | null;
      if (typeof body?.credential !== 'string' || !afterSitCredentialFormat.test(body.credential)) return unavailable();
      const hash = await hashAfterSitCredential(body.credential);
      const linkLimited = await deps.limit(request, env, `link:${hash}`);
      if (linkLimited) return privateResponse(linkLimited);
      return run(request, env, hash, body);
    };
  }

  const partyLink: Handler<E> = async (request, env, { eventId, attendeeId }) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return privateResponse(host.error);
    const limited = await deps.limit(request, env, `host:${host.accountId}`);
    if (limited) return privateResponse(limited);
    const body = await request.json().catch(() => null);
    return privateResponse(await issuePartyLink(env.DB, host.accountId, eventId, attendeeId, body));
  };

  const recap = withLink(async (request, env, hash) => {
    const seat = await findEligibleSeat(env.DB, hash) ?? await findPartyRecap(env.DB, hash);
    if (!seat) return unavailable();
    const { id, title, event_date, account_id, host_note, teas_json } = seat;
    const teas = JSON.parse(teas_json) as RecapTea[];

    // Launch 1 additions. Each is something this guest could already open:
    // a tea's own public page, the session's playlist and its published reading.
    const [extra, resolved] = await Promise.all([
      env.DB.prepare(
        `SELECT e.reading_article_id, e.is_tasting, COALESCE(NULLIF(trim(ps.playlist_url), ''), NULLIF(trim(e.playlist_url), '')) AS playlist_url
         FROM events e LEFT JOIN event_post_session ps ON ps.event_id = e.id AND ps.account_id = e.account_id
         WHERE e.id = ? AND e.account_id = ?`,
      ).bind(id, account_id).first<{ reading_article_id: string | null; is_tasting: number | null; playlist_url: string | null }>(),
      deps.readPublic ? servedTeasOf(env.DB, deps.readPublic(env), { id, account_id }) : Promise.resolve([]),
    ]);
    const paths = new Map(resolved.map(tea => [tea.id, 'href' in tea ? tea.href ?? null : null]));
    for (const tea of teas) tea.path = paths.get(tea.id) ?? null;
    const reading = extra?.reading_article_id ? await readableArticleFor(env.DB, account_id, extra.reading_article_id) : null;
    const body: Record<string, unknown> = {
      event: { id, title, event_date }, host_note, teas,
      playlist_url: extra?.playlist_url ?? null,
      reading: reading ? { slug: reading.slug, title: reading.title } : null,
    };
    // J8: a tasting's recap offers to add notes written on paper, one journal link per tea that has a record.
    // Launch 3 only (A3): with its switch off no recap is a tasting.
    body.is_tasting = anyoneHostsOpen(env) && Number(extra?.is_tasting) === 1;
    if (body.is_tasting) body.journal_teas = await journalTeasOf(env.DB, account_id, id);
    if (firstTableOpen(env)) {
      body.thanks_ref = await thanksRefFor(env.DB, id, account_id);
      const userId = deps.optionalUser ? await deps.optionalUser(request, env) : null;
      if (userId) {
        const kept = await keptSessionTeaIds(env.DB, userId, id);
        for (const tea of teas) tea.kept = kept.has(tea.id);
      }
    }
    return json(body);
  });

  // POST /api/after-sit/keep-tea { credential, teaId }: a signed-in guest keeps
  // one poured tea in their own Tea Chest. The seat link decides eligibility.
  const keepTea = withLink(async (request, env, credentialHash, body) => {
    if (!firstTableOpen(env)) return json({ error: 'Not found' }, 404);
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return privateResponse(actor.error);
    if (typeof body.teaId !== 'string' || !body.teaId) return unavailable();
    const item = await keepSessionTea(env.DB, {
      userId: actor.userId, credentialHash, teaId: body.teaId, readPublic: deps.readPublic?.(env),
    });
    return item ? json({ item }) : unavailable();
  });

  const setup = withLink(async (request, env, credentialHash, { action }) => {
    if (action !== 'status' && action !== 'save' && action !== 'remove') {
      return json({ error: 'Choose a setup action.' }, 400);
    }
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return privateResponse(actor.error);
    const seat = await findEligibleSeat(env.DB, credentialHash);
    if (!seat) return unavailable();

    const scope = { userId: actor.userId, accountId: seat.account_id };
    const access = { credentialHash };
    const kept = action === 'save'
      ? await saveKeptSetup(env.DB, scope, access)
      : await getKeptSetup(env.DB, scope, access);
    if (!kept) return json({ error: 'Use the signed-in account verified for this seat.' }, 403);
    if (action === 'remove') {
      return await eraseKeptSetup(env.DB, scope, kept.event_id)
        ? json({ saved: false })
        : json({ error: 'Remove the private photos before removing this setup.' }, 409);
    }
    return json(kept.saved_at
      ? { saved: true, saved_at: kept.saved_at, can_add_photos: true }
      : { saved: false });
  });

  const guestBook = withLink(async (request, env, hash, body) => {
    const { action, note, photo, teaId, publicRecap } = body;
    const photos = guestBookPhotoActions.has(action);
    const withPhoto = action === 'entry-save' && photo !== undefined;
    const wholeEntry = action === 'entry-withdraw';
    const method = action === 'read' ? 'GET'
      : action === 'send' || (action === 'entry-save' && !withPhoto) ? 'PUT'
      : action === 'withdraw' ? 'DELETE' : null;
    if (!method && !photos && !withPhoto && !wholeEntry) return json({ error: 'Choose a Guest Book action.' }, 400);
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return privateResponse(actor.error);
    const party = await findPartyLink(env.DB, hash);
    if (party) {
      // A personal link covers the guest book note only; photos stay with the booking's own link.
      if (photos || withPhoto) return unavailable();
      return privateResponse(await servePartyGuestBook(env.DB, party, hash, actor.userId, body));
    }
    const seat = await env.DB.prepare(
      `SELECT a.account_id, a.magic_token FROM after_sit_live_access l
       JOIN event_attendees a ON a.id = l.attendee_id AND a.event_id = l.event_id AND a.account_id = l.account_id
       ${eventJoins} WHERE l.credential_hash = ? AND l.expires_at > unixepoch() AND ${guestSeat}`,
    ).bind(hash).first<{ account_id: string; magic_token: string }>();
    if (!seat) return unavailable();
    const scope = { accountId: seat.account_id, userId: actor.userId };
    if (withPhoto) return privateResponse(await saveGuestBookEntryWithPhoto(env.DB, scope, hash, note, photo, { teaId, publicRecap }));
    if (wholeEntry) return privateResponse(await withdrawGuestBookEntry(env.DB, scope, hash));
    // Closed, a photograph keeps its grouping with its taker's note, as before PR 560.
    if (photos) return privateResponse(await serveGuestBookPhotos(request, env.DB, env.ATLAS_BUCKET, scope, hash, body, anyoneHostsOpen(env)));

    if (!method || !seat.magic_token) return unavailable();
    const input = new Request(request.url, { method, body: method === 'PUT' ? JSON.stringify({ note, teaId, publicRecap }) : undefined });
    return privateResponse(await serveGuestBook(input, env.DB, scope, seat.magic_token, hash));
  });

  // POST /api/after-sit/gallery { credential, action: 'read' | 'bytes', grantId? }:
  // the photographs from the table, for a signed-in person holding a seat link
  // for this session, the booking's own or a personal party link (as keeps).
  const galleryLink = withLink(async (request, env, hash, body) => {
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return privateResponse(actor.error);
    const resolveSeat = async () => {
      const seat = await findEligibleSeat(env.DB, hash) ?? await findPartyRecap(env.DB, hash);
      return seat ? { account_id: seat.account_id, event_id: seat.id } : null;
    };
    return privateResponse(await serveSessionGallery(
      request, env.DB, env.ATLAS_BUCKET, actor.userId, hash, resolveSeat, body,
    ));
  });
  // The gallery is Launch 3's (J7): closed with its switch (A3).
  const gallery: Handler<E> = (request, env, params) => anyoneHostsOpen(env)
    ? galleryLink(request, env, params)
    : Promise.resolve(json({ error: 'Not found' }, 404));

  const photoReview: Handler<E> = async (request, env, { eventId, grantId }) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return privateResponse(host.error);
    return privateResponse(await reviewGuestBookPhotos(request, env.DB, env.ATLAS_BUCKET, host.accountId, eventId, grantId));
  };

  const ownerPhoto: Handler<E> = async (request, env, { eventId, photoId }) => {
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return privateResponse(actor.error);
    return privateResponse(await serveOwnerGuestBookPhoto(request, env.DB, actor.userId, eventId, photoId));
  };

  return [
    ['POST', '/api/admin/events/:eventId/after-sit/:attendeeId', manage],
    ['DELETE', '/api/admin/events/:eventId/after-sit/:attendeeId', manage],
    ['POST', '/api/admin/events/:eventId/after-sit/:attendeeId/party', partyLink],
    ['POST', '/api/after-sit/recap', recap],
    ['POST', '/api/after-sit/keep-tea', keepTea],
    ['POST', '/api/after-sit/setup', setup],
    ['POST', '/api/after-sit/guest-book', guestBook],
    ['POST', '/api/after-sit/gallery', gallery],
    ['GET', '/api/admin/events/:eventId/guest-book/photos', photoReview],
    ['GET', '/api/admin/events/:eventId/guest-book/photos/:grantId', photoReview],
    ['PUT', '/api/admin/events/:eventId/guest-book/photos/:grantId', photoReview],
    ['GET', '/api/me/personal-kept-setups/:eventId/photos/:photoId/guest-book', ownerPhoto],
    ['DELETE', '/api/me/personal-kept-setups/:eventId/photos/:photoId/guest-book', ownerPhoto],
  ];
}
