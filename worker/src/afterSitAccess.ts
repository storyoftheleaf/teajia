import { serveGuestBook } from './sessionGuestBook';
import {
  reviewGuestBookPhotos, saveGuestBookEntryWithPhoto, serveGuestBookPhotos, serveOwnerGuestBookPhoto,
  withdrawGuestBookEntry, type GuestBookPhotoInput,
} from './sessionGuestBookPhotos';
import { afterSitCredentialFormat, createAfterSitCredential, hashAfterSitCredential } from './afterSitCredential';
import { getKeptSetup, namedSetupTeas, saveKeptSetup } from './privateKeptSetups';
import { eraseKeptSetup } from './privateKeptSetupPhotos';
import { findPartyLink, findPartyRecap, issuePartyLink, revokePartyLinks, servePartyGuestBook } from './afterSitPartyLinks';

type AfterSitEnv = { DB: D1Database; ATLAS_BUCKET?: R2Bucket };
type LinkInput = GuestBookPhotoInput & { credential?: unknown; note?: unknown; photo?: unknown; teaId?: unknown; publicRecap?: unknown };
const guestBookPhotoActions = new Set<unknown>(['photos-read', 'photo-bytes', 'private-photo-preview', 'photo-offer', 'photo-withdraw']);
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Authorization<E, Scope> = (request: Request, env: E) => Promise<Scope | { error: Response }>;

type Deps<E> = {
  requireHost: Authorization<E, { accountId: string }>;
  requireUser: Authorization<E, { userId: string }>;
  limit: (request: Request, env: E, key: string) => Promise<Response | null>;
};

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

function findEligibleSeat(db: D1Database, credentialHash: string) {
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

    const credential = createAfterSitCredential();
    const hash = await hashAfterSitCredential(credential);
    const expiresAt = Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS;
    // The first link for a seat takes the main slot (or replaces one that has
    // expired); a later copy is added beside it, so a link the guest already
    // has keeps working until it expires.
    const eligible = `SELECT a.id, a.event_id, a.account_id, ?, ? FROM event_attendees a
       ${eventJoins}
       WHERE a.id = ? AND a.event_id = ? AND a.account_id = ? AND ${guestSeat}`;
    const [, first, extra] = await env.DB.batch([
      env.DB.prepare(`DELETE FROM after_sit_extra_access WHERE attendee_id = ? AND event_id = ? AND account_id = ?
        AND expires_at <= unixepoch()`).bind(...scope),
      env.DB.prepare(`INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at)
       ${eligible}
       ON CONFLICT(attendee_id, event_id, account_id) DO UPDATE SET
         credential_hash = excluded.credential_hash, expires_at = excluded.expires_at
       WHERE after_sit_access.expires_at <= unixepoch()`).bind(hash, expiresAt, ...scope),
      env.DB.prepare(`INSERT INTO after_sit_extra_access (attendee_id, event_id, account_id, credential_hash, expires_at)
       ${eligible} AND NOT EXISTS (SELECT 1 FROM after_sit_access held WHERE held.credential_hash = ?)`)
        .bind(hash, expiresAt, ...scope, hash),
    ]);
    return first.meta?.changes || extra.meta?.changes
      ? json({ credential, expires_at: new Date(expiresAt * 1000).toISOString() }) : unavailable();
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

  const recap = withLink(async (_request, env, hash) => {
    const seat = await findEligibleSeat(env.DB, hash) ?? await findPartyRecap(env.DB, hash);
    if (!seat) return unavailable();
    const { id, title, event_date, host_note, teas_json } = seat;
    return json({ event: { id, title, event_date }, host_note, teas: JSON.parse(teas_json) });
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
    if (photos) return privateResponse(await serveGuestBookPhotos(request, env.DB, env.ATLAS_BUCKET, scope, hash, body));

    if (!method || !seat.magic_token) return unavailable();
    const input = new Request(request.url, { method, body: method === 'PUT' ? JSON.stringify({ note, teaId, publicRecap }) : undefined });
    return privateResponse(await serveGuestBook(input, env.DB, scope, seat.magic_token, hash));
  });

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
    ['POST', '/api/after-sit/setup', setup],
    ['POST', '/api/after-sit/guest-book', guestBook],
    ['GET', '/api/admin/events/:eventId/guest-book/photos', photoReview],
    ['GET', '/api/admin/events/:eventId/guest-book/photos/:grantId', photoReview],
    ['PUT', '/api/admin/events/:eventId/guest-book/photos/:grantId', photoReview],
    ['GET', '/api/me/personal-kept-setups/:eventId/photos/:photoId/guest-book', ownerPhoto],
    ['DELETE', '/api/me/personal-kept-setups/:eventId/photos/:photoId/guest-book', ownerPhoto],
  ];
}
