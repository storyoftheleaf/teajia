import { FAMILY_FULL_LONG_EDGE, FAMILY_FULL_MAX_BYTES, FAMILY_MIN_LONG_EDGE } from '../../src/lib/familyContract';
import { inspectJpeg } from './familyJpeg';

export const privatePhotoHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export function privatePhotoResponse(body: object, status = 200) {
  return Response.json(body, { status, headers: privatePhotoHeaders });
}

export async function readPrivatePhotoUpload(request: Request, acceptsTeaId = false) {
  if (!request.headers.get('Content-Type')?.includes('multipart/form-data')) {
    return { error: privatePhotoResponse({ error: 'Choose a photo to add.' }, 415) };
  }
  if (Number(request.headers.get('Content-Length')) > FAMILY_FULL_MAX_BYTES + 65536) {
    return { error: privatePhotoResponse({ error: 'That photo is too large.' }, 413) };
  }
  const form = await request.formData().catch(() => null);
  const image: unknown = form?.get('image');
  const requestedId = form?.get('photo_id');
  const teaId = form?.get('tea_id') || null;
  if (!(image instanceof File) || image.type !== 'image/jpeg') {
    return { error: privatePhotoResponse({ error: 'Choose a JPEG photo.' }, 415) };
  }
  if (image.size > FAMILY_FULL_MAX_BYTES) {
    return { error: privatePhotoResponse({ error: 'That photo is too large.' }, 413) };
  }
  if (requestedId && (typeof requestedId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestedId))) {
    return { error: privatePhotoResponse({ error: 'Invalid photo identifier.' }, 400) };
  }
  if (teaId && (!acceptsTeaId || typeof teaId !== 'string')) {
    return { error: privatePhotoResponse({ error: 'That tea is not part of this photo subject.' }, 400) };
  }
  return { photoId: requestedId || crypto.randomUUID(), image, teaId };
}

export async function validatePrivatePhotoBytes(image: File) {
  const bytes = new Uint8Array(await image.arrayBuffer());
  const jpeg = inspectJpeg(bytes);
  if (!jpeg.ok) {
    return { error: privatePhotoResponse({ error: 'Choose the photo again to remove camera details or repair the file.' }, 422) };
  }
  const edge = Math.max(jpeg.width, jpeg.height);
  if (edge < FAMILY_MIN_LONG_EDGE || edge > FAMILY_FULL_LONG_EDGE) {
    return { error: privatePhotoResponse({ error: 'The photo is the wrong size.' }, 422) };
  }
  return { bytes };
}

export async function servePrivatePhotoObject(bucket: R2Bucket | undefined, key: string) {
  if (!bucket) return privatePhotoResponse({ error: 'Private photo storage is unavailable.' }, 503);
  const image = await bucket.get(key);
  return image ? new Response(image.body, { headers: { ...privatePhotoHeaders, 'Content-Type': 'image/jpeg' } })
    : privatePhotoResponse({ error: 'Photo not found.' }, 404);
}
