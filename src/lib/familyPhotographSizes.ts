/**
 * Makes the two copies of a member photograph on the phone.
 *
 * Workers cannot resize a picture, so the phone makes both sizes and the
 * upload door (POST /api/family/photographs) only checks them. Every copy is
 * drawn onto a canvas and re-encoded as JPEG, even a picture already small
 * enough, because the re-encode is what drops the camera's location data:
 * the door refuses a JPEG that still carries it.
 *
 * Limits come from src/lib/familyContract.ts, the same file the door reads.
 */
import {
  FAMILY_FULL_LONG_EDGE, FAMILY_FULL_MAX_BYTES, FAMILY_PHOTO_TYPE,
  FAMILY_SMALL_LONG_EDGE, FAMILY_SMALL_MAX_BYTES,
} from './familyContract';

export interface FamilySize { width: number; height: number }

/** The size of a copy whose long edge may not exceed `longEdge`. Never enlarges. */
export function fitWithin(width: number, height: number, longEdge: number): FamilySize {
  const longest = Math.max(width, height);
  if (!(longest > 0)) throw new Error('A photograph needs a width and a height.');
  const scale = Math.min(1, longEdge / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Both copies' sizes for a picture of this size. */
export function familyPhotographSizes(width: number, height: number): { full: FamilySize; small: FamilySize } {
  return {
    full: fitWithin(width, height, FAMILY_FULL_LONG_EDGE),
    small: fitWithin(width, height, FAMILY_SMALL_LONG_EDGE),
  };
}

/** Qualities tried in turn until the copy fits under its byte limit. */
export const FAMILY_QUALITY_STEPS = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48] as const;

async function encode(bitmap: ImageBitmap, size: FamilySize, maxBytes: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This phone could not prepare the photograph.');
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  for (const quality of FAMILY_QUALITY_STEPS) {
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, FAMILY_PHOTO_TYPE, quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error('That photograph is too detailed to send. Try another.');
}

/** The large and small copies of one photograph, both freshly encoded JPEG. */
export async function prepareFamilyPhotograph(file: Blob): Promise<{ full: Blob; small: Blob; sizes: { full: FamilySize; small: FamilySize } }> {
  // `imageOrientation: 'from-image'` keeps a portrait photograph upright once its Exif is gone.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const sizes = familyPhotographSizes(bitmap.width, bitmap.height);
    const full = await encode(bitmap, sizes.full, FAMILY_FULL_MAX_BYTES);
    const small = await encode(bitmap, sizes.small, FAMILY_SMALL_MAX_BYTES);
    return { full, small, sizes };
  } finally {
    bitmap.close?.();
  }
}
