/**
 * A sample tasting saved again with the same id.
 *
 * The sample page keeps one tasting id for one opening of the tasting, so a
 * second Save in that opening sends the id again with the edited tasting. The
 * same author sending it again for the same sample updates the stored row in
 * place (its created time and author stay); anything else is refused.
 *
 * Who the author is: a signed-in taster is their verified email. A guest has
 * no identity of its own (each request gets a fresh guest id), so the first
 * save hands back an edit key, an HMAC of the tasting id under a key derived
 * from the worker's secret (see `sampleTastingEditKey` for why it is never
 * the secret itself). The key is never stored and never appears in a read of the sample,
 * so only the device that made the tasting holds it.
 *
 * A request that cannot prove authorship but sends exactly what is stored is a
 * retried first save (the client retries on timeout): it is answered with the
 * stored row, as before, and without a key.
 */

export interface StoredSampleTasting {
  id: string;
  sample_id: string;
  account_id: string | null;
  taster_id: string;
  tasting: string;
  rating: number | null;
  verdict: string;
  would_buy: number;
  personal_note: string | null;
}

export interface SampleTastingWrite {
  tasting: string;
  rating: number | null;
  verdict: string;
  would_buy: number;
  personal_note: string | null;
}

export type SampleTastingRepeat =
  | { kind: 'update' }
  | { kind: 'unchanged' }
  | { kind: 'refuse'; error: string };

async function hmacBytes(keyBytes: Uint8Array, text: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

/**
 * The key a guest presents to change its own tasting.
 *
 * NEVER an HMAC of caller-chosen text under the worker's secret itself. The
 * tasting id is chosen by the caller and the key is handed back to an
 * unauthenticated guest; sign-in tokens are HMACs under that same secret and
 * `verifyToken` does not inspect the token header, so a key computed directly
 * under the secret would be a signing oracle for forged sign-in tokens. The
 * edit key is therefore computed under a key DERIVED from the secret with a
 * fixed label. The derived key never leaves the worker, and nothing a guest
 * receives is a signature under the secret.
 */
export async function sampleTastingEditKey(secret: string, tastingId: string): Promise<string> {
  const derived = await hmacBytes(new TextEncoder().encode(secret), 'teajia/sample-tasting-edit-key/v1');
  const signature = await hmacBytes(derived, tastingId);
  return Array.from(signature).map(n => n.toString(16).padStart(2, '0')).join('');
}

/** Compares two keys without stopping at the first difference. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sameContent(stored: StoredSampleTasting, write: SampleTastingWrite): boolean {
  return stored.tasting === write.tasting
    && (stored.rating ?? null) === write.rating
    && stored.verdict === write.verdict
    && Number(stored.would_buy) === write.would_buy
    && (stored.personal_note ?? null) === write.personal_note;
}

/** What a save that repeats a stored tasting's id may do. */
export async function decideSampleTastingRepeat(
  stored: StoredSampleTasting,
  input: {
    sampleId: string;
    accountId: string;
    requesterEmail: string | null;
    editKey: unknown;
    secret: string;
    write: SampleTastingWrite;
  },
): Promise<SampleTastingRepeat> {
  if (stored.sample_id !== input.sampleId) return { kind: 'refuse', error: 'Tasting id belongs to another sample' };
  if ((stored.account_id ?? input.accountId) !== input.accountId) return { kind: 'refuse', error: 'Tasting id belongs to another account' };
  const signedInAuthor = stored.taster_id.includes('@');
  const provenBySignIn = signedInAuthor && !!input.requesterEmail && input.requesterEmail === stored.taster_id;
  const provenByKey = !signedInAuthor && typeof input.editKey === 'string' && input.editKey.length > 0
    && sameKey(input.editKey, await sampleTastingEditKey(input.secret, stored.id));
  if (provenBySignIn || provenByKey) return { kind: 'update' };
  if (sameContent(stored, input.write)) return { kind: 'unchanged' };
  return { kind: 'refuse', error: 'Tasting id belongs to another taster' };
}
