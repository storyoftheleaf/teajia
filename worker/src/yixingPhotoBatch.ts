export type ReviewPhoto = { role: string; sha256: string; originalSha256: string };
type Slot = { potId: string; slot: number };
type Change = Slot & { before: ReviewPhoto; after: ReviewPhoto; needsReview?: boolean };
type Proposal = { id: string; changes: Change[] };
type Gallery = Record<string, ReviewPhoto>;
type Pot = { id: string; photos?: ReviewPhoto[] };
type Json = (value: unknown, status?: number) => Response;

const hash = /^[a-f0-9]{64}$/;
const slotKey = ({ potId, slot }: Slot) => potId + '/' + slot;
const samePhoto = (a: ReviewPhoto | undefined, b: ReviewPhoto) =>
  a?.sha256 === b.sha256 && a.originalSha256 === b.originalSha256 && a.role === b.role;

function validPhoto(photo: ReviewPhoto) {
  return photo && typeof photo.role === 'string' && photo.role.length > 0 && photo.role.length <= 72
    && hash.test(photo.sha256) && hash.test(photo.originalSha256);
}

export async function readPhotoGallery(bucket: R2Bucket, prefix: string) {
  const object = await bucket.get(prefix + 'photo-batches/gallery.json');
  return { photos: object ? await object.json<Gallery>() : {}, etag: object?.etag };
}

export function overlayPhotoGallery<T extends Pot>(pots: T[], gallery: Gallery): T[] {
  return pots.map(pot => pot.photos ? {
    ...pot,
    photos: pot.photos.map((photo, slot) => gallery[slotKey({ potId: pot.id, slot })] ?? photo),
  } : pot);
}

async function readProposal(bucket: R2Bucket, prefix: string, pots: Pot[]) {
  const object = await bucket.get(prefix + 'photo-batches/proposal.json');
  if (!object) return null;
  const proposal = await object.json<Proposal>();
  if (!hash.test(proposal.id) || !Array.isArray(proposal.changes) || proposal.changes.length > pots.reduce((count, pot) => count + (pot.photos?.length ?? 0), 0)) {
    throw new Error('Invalid photo batch');
  }
  const seen = new Set<string>();
  const byId = new Map(pots.map(pot => [pot.id, pot]));
  for (const change of proposal.changes) {
    const key = slotKey(change);
    if (!Number.isSafeInteger(change.slot) || !byId.get(change.potId)?.photos?.[change.slot]
      || !validPhoto(change.before) || !validPhoto(change.after)
      || samePhoto(change.before, change.after) || seen.has(key)
      || (change.needsReview !== undefined && typeof change.needsReview !== 'boolean')) {
      throw new Error('Invalid photo replacement');
    }
    seen.add(key);
  }
  return proposal;
}

function unresolved(change: Change, gallery: Gallery, pots: Pot[]) {
  const current = gallery[slotKey(change)] ?? pots.find(pot => pot.id === change.potId)?.photos?.[change.slot];
  if (samePhoto(current, change.after)) return 'applied';
  return samePhoto(current, change.before) ? 'pending' : 'stale';
}

async function mediaExists(bucket: R2Bucket, prefix: string, changes: Change[]) {
  const hashes = new Set(changes.flatMap(change => [
    ...(change.after.sha256 !== change.before.sha256 ? [change.after.sha256] : []),
    ...(change.after.originalSha256 !== change.before.originalSha256 ? [change.after.originalSha256] : []),
  ]));
  const ids = [...hashes];
  for (let index = 0; index < ids.length; index += 8) {
    const results = await Promise.all(ids.slice(index, index + 8).map(id => bucket.head(prefix + 'media/' + id + '.jpg')));
    if (results.some(result => !result)) return false;
  }
  return true;
}

/** Changes only the private photo overlay. The original board and owner choices have independent keys. */
export async function serveYixingPhotoBatch(request: Request, bucket: R2Bucket, prefix: string, pots: Pot[], json: Json) {
  const proposal = await readProposal(bucket, prefix, pots);
  if (request.method === 'GET') {
    if (!proposal) return json({ id: null, changes: [] });
    const { photos } = await readPhotoGallery(bucket, prefix);
    const pending = proposal.changes.filter(change => unresolved(change, photos, pots) !== 'applied');
    if (pending.some(change => unresolved(change, photos, pots) === 'stale')) {
      return json({ error: 'This batch was prepared against older photos. Prepare a fresh comparison.' }, 409);
    }
    return json({ id: proposal.id, changes: pending });
  }
  if (request.method !== 'PUT') return json({ error: 'Photo review route not found' }, 404);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Send a JSON selection' }, 415);
  if (Number(request.headers.get('Content-Length')) > 16384) return json({ error: 'Selection is too large' }, 413);
  const text = await request.text();
  if (text.length > 16384) return json({ error: 'Selection is too large' }, 413);
  let input: { id?: string; selections?: Slot[] } | null;
  try { input = JSON.parse(text); } catch { return json({ error: 'Invalid JSON selection' }, 400); }
  if (!proposal || input?.id !== proposal.id) return json({ error: 'The batch changed. Open the current comparison.' }, 409);
  const slots = input.selections;
  if (!Array.isArray(slots) || slots.length === 0 || slots.length > proposal.changes.length
    || slots.some(slot => !slot || typeof slot.potId !== 'string' || !Number.isSafeInteger(slot.slot))) {
    return json({ error: 'Choose at least one photo replacement from this batch.' }, 400);
  }
  const selected = new Set(slots.map(slotKey));
  const changes = proposal.changes.filter(change => selected.has(slotKey(change)));
  if (selected.size !== slots.length || changes.length !== selected.size) {
    return json({ error: 'Choose photos from this batch once each.' }, 400);
  }
  const key = prefix + 'photo-batches/gallery.json';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { photos, etag } = await readPhotoGallery(bucket, prefix);
    const pending = changes.filter(change => unresolved(change, photos, pots) !== 'applied');
    if (!pending.length) return json({ applied: 0 });
    if (pending.some(change => unresolved(change, photos, pots) === 'stale')) {
      return json({ error: 'The current photos changed. Open a fresh comparison.' }, 409);
    }
    if (!await mediaExists(bucket, prefix, pending)) return json({ error: 'Some replacements are unavailable. Your gallery is unchanged.' }, 503);
    for (const change of pending) photos[slotKey(change)] = change.after;
    const saved = await bucket.put(key, JSON.stringify(photos), {
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    if (saved) return json({ applied: pending.length });
  }
  return json({ error: 'The gallery changed. Review the remaining photos again.' }, 409);
}
