/**
 * Teajia family: who may fetch a member's photograph from /api/media.
 *
 * A photograph's address holds an unguessable id, but an address that was once
 * public stays in anyone's history. So a stored family photograph is served to
 * the public only while it is on show: shared to a page or offered, not taken
 * off the page by its author, and not hidden by the shop (or the shop's own
 * placed or lead picture, which stays on the tea page by design). Everyone
 * else, the author looking at a private picture and the shop reading its pile,
 * gets a short-lived signed address from this module.
 *
 * Other keys are not family photographs and are not decided here.
 */
const MEDIA_PREFIX = 'https://media.teajia.co/';
export const FAMILY_PHOTO_KEY_PREFIX = 'family-photos/';
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

export type FamilyMediaVerdict = 'not-family' | 'public' | 'signed' | 'refused';

export async function familyMediaVerdict(
  db: D1Database, secret: string | undefined, key: string, params: URLSearchParams,
): Promise<FamilyMediaVerdict> {
  if (!key.startsWith(FAMILY_PHOTO_KEY_PREFIX)) return 'not-family';
  if (await validSignature(secret, key, params)) return 'signed';
  const row = await db.prepare(
    `SELECT 1 AS ok FROM member_photographs p
       JOIN products lot ON lot.id = p.product_id AND lot.account_id = p.account_id
       JOIN accounts a ON a.id = lot.account_id
      WHERE lot.is_public = 1 AND lot.shown_in_shop = 1 AND lot.status IN ('Active', 'Sold Out')
        AND a.status = 'active' AND a.public_enabled = 1
        AND (p.full_key = ?1 OR p.small_key = ?1)
        AND (
          (p.removed_by_member_at IS NULL AND p.share_state IN ('page', 'offered'))
          OR (p.offered_at IS NOT NULL AND p.shop_use IN ('placed', 'lead'))
        )
        AND NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'photograph' AND h.target_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'tasting' AND h.target_id = p.journal_entry_id)
        AND NOT EXISTS (SELECT 1 FROM family_hides h JOIN contributors hc ON hc.id = h.target_id
                         WHERE h.account_id = p.account_id AND h.target_kind = 'page' AND hc.user_id = p.author_user_id)`,
  ).bind(key).first();
  return row ? 'public' : 'refused';
}
