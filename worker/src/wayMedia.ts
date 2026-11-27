// The step photographs of the way in, served only by a signed address
// (Launch 2, audit A2, findings F1 and F2).
//
// A step photograph (a key under accounts/<id>/venue-guide/, or an older one
// uploaded as a flyer and named in a guide) is never served by its bare
// address. The guide is stored with bare addresses; every answer that hands a
// guide out signs its photographs here:
// - the guest's own page signs them for that seat (`for=<attendee id>`), until
//   the session ends or WAY_SIGNED_SECONDS pass, whichever is first. Each
//   fetch checks the seat again (see wayMediaVerdict), so a seat that is no
//   longer confirmed, a session that has ended, or a host whose door has
//   closed stops the photographs at once, and a guide reused at another table
//   gives an earlier table's guest nothing.
// - the host's own reads (the walkthrough editor, the admin event form, saved
//   places) sign them for the host (`for=host`), for WAY_SIGNED_SECONDS.
// The phone keeps the bytes it was given (src/lib/keptWay.ts), so the kept way
// still opens with no signal. House photographs (accounts/<id>/venues/) are
// public by Adrian's decision (2026-11-26) and are not decided here.

import { sessionHasEnded, sitWayOpen } from '../../shared/sessionEnd';

export const WAY_MEDIA_ORIGIN = 'https://media.teajia.co/';
export const WAY_SIGNED_SECONDS = 60 * 60;
export const WAY_HOST = 'host';
/** A photograph signed for whoever holds one sit's link: `sit:<event id>`. */
export const SIT_HOLDER = 'sit:';

const STEP_KEY = /^accounts\/[^/]+\/venue-guide\//;
const FLYER_KEY = /^accounts\/([^/]+)\/flyers\/[^/]+$/;

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');

async function mac(secret: string, key: string, exp: number, holder: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`way-media:${key}:${exp}:${holder}`)));
}

/** The media key a stored step photograph names, or null for any other address. */
export function wayPhotoKey(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith(WAY_MEDIA_ORIGIN)) return null;
  const key = url.slice(WAY_MEDIA_ORIGIN.length).split(/[?#]/)[0];
  return key || null;
}

/** A step photograph's address as it is stored: bare, with no signature. */
export function bareWayPhotoUrl(url: string): string {
  const key = wayPhotoKey(url);
  return key ? `${WAY_MEDIA_ORIGIN}${key}` : url;
}

/** A signed address for one key, held by a seat or by the host. */
export async function signedWayPhotoUrl(secret: string, key: string, holder: string, exp: number): Promise<string> {
  return `${WAY_MEDIA_ORIGIN}${key}?exp=${exp}&for=${encodeURIComponent(holder)}&sig=${await mac(secret, key, exp, holder)}`;
}

type GuideLike = { steps?: Array<{ image_url?: unknown; video_url?: unknown } & Record<string, unknown>> } & Record<string, unknown>;

function parseGuide(value: unknown): GuideLike | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as GuideLike;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as GuideLike : null;
  } catch {
    return null;
  }
}

/**
 * The guide with each step photograph signed for its holder. Given a string,
 * a string comes back (the guest page's shape); given an object, an object.
 * With no secret nothing can be signed, so the photographs are left out.
 */
export async function signWayGuide<T>(secret: string | undefined, guide: T, holder: string, options: { now?: number; endsAt?: number | null } = {}): Promise<T> {
  const parsed = parseGuide(guide);
  if (!parsed || !Array.isArray(parsed.steps)) return guide;
  const now = options.now ?? Date.now();
  let exp = Math.floor(now / 1000) + WAY_SIGNED_SECONDS;
  if (options.endsAt != null && Number.isFinite(options.endsAt)) exp = Math.min(exp, Math.floor(options.endsAt / 1000));
  const steps = await Promise.all(parsed.steps.map(async step => {
    if (!step || typeof step !== 'object') return step;
    const key = wayPhotoKey(step.image_url);
    const filmKey = wayPhotoKey(step.video_url);
    if (!key && !filmKey) return step;
    const signed = { ...step };
    if (key) {
      if (secret) signed.image_url = await signedWayPhotoUrl(secret, key, holder, exp);
      else delete signed.image_url;
    }
    // A film uploaded for the way in is signed as its photograph is.
    if (filmKey) {
      if (secret) signed.video_url = await signedWayPhotoUrl(secret, filmKey, holder, exp);
      else delete signed.video_url;
    }
    return signed;
  }));
  const signed: Record<string, unknown> = { ...parsed, steps };
  // The picture of the tea space travels with the way and is signed like a step photograph.
  const spaceKey = wayPhotoKey(parsed.space_image_url);
  if (spaceKey) {
    if (secret) signed.space_image_url = await signedWayPhotoUrl(secret, spaceKey, holder, exp);
    else delete signed.space_image_url;
  }
  return (typeof guide === 'string' ? JSON.stringify(signed) : signed) as T;
}

/** Every step photograph in a stored guide, as bare addresses. */
export function guidePhotoUrls(guide: unknown): Set<string> {
  const parsed = parseGuide(guide);
  const urls = new Set<string>();
  for (const step of parsed?.steps ?? []) {
    if (step && typeof step.image_url === 'string' && step.image_url) urls.add(bareWayPhotoUrl(step.image_url));
    if (step && typeof step.video_url === 'string' && wayPhotoKey(step.video_url)) urls.add(bareWayPhotoUrl(step.video_url));
  }
  if (typeof parsed?.space_image_url === 'string' && parsed.space_image_url) urls.add(bareWayPhotoUrl(parsed.space_image_url));
  return urls;
}

/** Whether a key is a step photograph, which is never served by its bare address. */
export async function isStepPhotoKey(db: D1Database | undefined, key: string): Promise<boolean> {
  if (STEP_KEY.test(key)) return true;
  const flyer = FLYER_KEY.exec(key);
  if (!flyer || !db) return false;
  try {
    const row = await db.prepare(
      `SELECT
         EXISTS (SELECT 1 FROM events WHERE account_id = ?1 AND venue_guide IS NOT NULL AND instr(venue_guide, ?2) > 0)
         OR EXISTS (SELECT 1 FROM saved_locations WHERE account_id = ?1 AND venue_guide IS NOT NULL AND instr(venue_guide, ?2) > 0) AS in_guide,
         EXISTS (SELECT 1 FROM events WHERE account_id = ?1 AND flyer_image_url IS NOT NULL AND instr(flyer_image_url, ?2) > 0) AS a_flyer`,
    ).bind(flyer[1], key).first<{ in_guide: number; a_flyer: number }>();
    // A flyer that is also a session's poster stays public, as posters are.
    return Number(row?.in_guide) === 1 && Number(row?.a_flyer) !== 1;
  } catch {
    // When it cannot be told, keep the photograph private.
    return true;
  }
}

async function validSignature(secret: string | undefined, key: string, params: URLSearchParams, now: number): Promise<string | null> {
  const exp = Number(params.get('exp'));
  const sig = params.get('sig');
  const holder = params.get('for');
  if (!secret || !sig || !holder || !Number.isFinite(exp) || exp * 1000 < now) return null;
  const expected = await mac(secret, key, exp, holder);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? holder : null;
}

export type WayMediaVerdict = 'not-step' | 'signed' | 'refused';

/**
 * Whether /api/media may serve this key. A step photograph needs a valid
 * signature; one signed for a seat is served only while that seat may still
 * see this guide (confirmed, before the end, the host's door open, and the
 * seat's own session names the photograph). `doorSql` is the guest page's
 * own door rule (privateHostDoorSql in index.ts), over `e` and `a`.
 */
export async function wayMediaVerdict(
  db: D1Database | undefined, secret: string | undefined, key: string, params: URLSearchParams, doorSql: string, now = Date.now(),
): Promise<WayMediaVerdict> {
  if (!(await isStepPhotoKey(db, key))) return 'not-step';
  const holder = await validSignature(secret, key, params, now);
  if (!holder) return 'refused';
  if (holder === WAY_HOST) return 'signed';
  if (!db) return 'refused';
  // A sit sent by its own link (pourSit.ts): the photograph is served while
  // that sit still names it, still has its link, and its day is not over.
  if (holder.startsWith(SIT_HOLDER)) {
    const sit = await db.prepare(
      `SELECT e.event_date, e.event_end_date, e.timezone, e.lifecycle_status, e.status FROM events e
        WHERE e.id = ? AND e.sit_link_code IS NOT NULL AND e.venue_guide IS NOT NULL AND instr(e.venue_guide, ?) > 0`,
    ).bind(holder.slice(SIT_HOLDER.length), `${WAY_MEDIA_ORIGIN}${key}`).first<Record<string, unknown>>();
    return sit && sitWayOpen(sit, now) ? 'signed' : 'refused';
  }
  const seat = await db.prepare(
    `SELECT ea.status, e.event_date, e.event_end_date, e.timezone, e.lifecycle_status, e.status AS event_status,
            ${doorSql} AS door_open
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
       JOIN accounts a ON a.id = e.account_id
      WHERE ea.id = ? AND e.venue_guide IS NOT NULL AND instr(e.venue_guide, ?) > 0`,
  ).bind(holder, `${WAY_MEDIA_ORIGIN}${key}`).first<Record<string, unknown>>();
  if (!seat || seat.status !== 'confirmed' || Number(seat.door_open) !== 1) return 'refused';
  if (sessionHasEnded({
    event_date: seat.event_date, event_end_date: seat.event_end_date, timezone: seat.timezone,
    lifecycle_status: seat.lifecycle_status, status: seat.event_status,
  }, now)) return 'refused';
  return 'signed';
}
