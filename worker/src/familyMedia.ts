/**
 * Teajia family: who may fetch a member's photograph from /api/media.
 *
 * A photograph's address holds an unguessable id, but an address that was once
 * public stays in anyone's history. So a stored family photograph is served to
 * the public only while it is on show: shared to a page or offered, not taken
 * off the page by its author, and not hidden by the shop, with the tasting it
 * belongs to. A placed or lead picture its author made private is withdrawn
 * too (A4 review, finding 3). Everyone else, the author looking at a private
 * picture and the shop reading its pile, gets a short-lived signed address
 * from this module.
 *
 * Other keys are not family photographs and are not decided here.
 */
import { PHOTO_TASTING_NOT_HIDDEN } from './familyPersonTastings';

const MEDIA_PREFIX = 'https://media.teajia.co/';
export const FAMILY_PHOTO_KEY_PREFIX = 'family-photos/';
/** A question's photograph on the Tea Table lives under the family prefix, so it is never served without this door's yes. */
export const QUESTION_PHOTO_KEY_PREFIX = `${FAMILY_PHOTO_KEY_PREFIX}tea-table-questions/`;
const SIGNED_SECONDS = 12 * 60 * 60;

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');

async function mac(secret: string, key: string, exp: number): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`family-media:${key}:${exp}`)));
}

/** The canonical address of a key, signed for a few hours when a secret is held. */
export async function signedFamilyMediaUrl(secret: string | undefined, key: string, now = Date.now()): Promise<string> {
  if (!secret) return `${MEDIA_PREFIX}${key}`;
  const exp = Math.floor(now / 1000) + SIGNED_SECONDS;
  return `${MEDIA_PREFIX}${key}?exp=${exp}&sig=${await mac(secret, key, exp)}`;
}

/** Signs the two addresses of a photograph in place. */
export async function signPhotograph<T extends { full_url?: string | null; small_url?: string | null }>(secret: string | undefined, photo: T): Promise<T> {
  const sign = async (url: string | null | undefined) =>
    url && url.startsWith(MEDIA_PREFIX) && !url.includes('?') ? signedFamilyMediaUrl(secret, url.slice(MEDIA_PREFIX.length)) : url;
  return { ...photo, full_url: await sign(photo.full_url), small_url: await sign(photo.small_url) };
}

async function validSignature(secret: string | undefined, key: string, params: URLSearchParams, now = Date.now()): Promise<boolean> {
  const exp = Number(params.get('exp'));
  const sig = params.get('sig');
  if (!secret || !sig || !Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await mac(secret, key, exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/**
 * A family photograph the public may see: on show (shared to a page or
 * offered, not taken off by its author), of a public tea in an open shop, and
 * hidden by the shop neither itself, nor with its tasting, nor with its
 * author's page. The media door serves exactly these, so anything that points
 * the public at a photograph (the people list's portrait) uses this too.
 * Needs the member_photographs row aliased `p`.
 */
export const FAMILY_PHOTO_PUBLIC_SQL = `p.removed_by_member_at IS NULL
  AND p.share_state IN ('page', 'offered')
  AND EXISTS (SELECT 1 FROM products lot JOIN accounts a ON a.id = lot.account_id
               WHERE lot.id = p.product_id AND lot.account_id = p.account_id
                 AND lot.is_public = 1 AND lot.shown_in_shop = 1 AND lot.status IN ('Active', 'Sold Out')
                 AND a.status = 'active' AND a.public_enabled = 1)
  AND NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'photograph' AND h.target_id = p.id)
  AND ${PHOTO_TASTING_NOT_HIDDEN}
  AND NOT EXISTS (SELECT 1 FROM family_hides h JOIN contributors hc ON hc.id = h.target_id
                   WHERE h.account_id = p.account_id AND h.target_kind = 'page' AND hc.user_id = p.author_user_id)`;

export type FamilyMediaVerdict = 'not-family' | 'public' | 'signed' | 'refused';

export async function familyMediaVerdict(
  db: D1Database, secret: string | undefined, key: string, params: URLSearchParams,
): Promise<FamilyMediaVerdict> {
  if (!key.startsWith(FAMILY_PHOTO_KEY_PREFIX)) return 'not-family';
  if (await validSignature(secret, key, params)) return 'signed';
  if (key.startsWith(QUESTION_PHOTO_KEY_PREFIX)) {
    // "Does anyone know this tea?" (knowThisTea.ts): public only while the question is on the table.
    const question = await db.prepare(
      `SELECT 1 AS ok FROM tea_table_questions WHERE (full_key = ?1 OR small_key = ?1) AND taken_off_at IS NULL AND hidden_at IS NULL`,
    ).bind(key).first();
    return question ? 'public' : 'refused';
  }
  const row = await db.prepare(
    `SELECT 1 AS ok FROM member_photographs p
      WHERE (p.full_key = ?1 OR p.small_key = ?1) AND ${FAMILY_PHOTO_PUBLIC_SQL}`,
  ).bind(key).first();
  return row ? 'public' : 'refused';
}
