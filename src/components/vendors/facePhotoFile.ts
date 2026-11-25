/**
 * Make a dropped face photo something every browser can show and upload.
 *
 * iPhone photos arrive as HEIC, which Chrome (and the Claude app's browser)
 * cannot draw: the tray showed a broken picture and the save would have
 * failed (Adrian, 2026-11-25). A photo the browser can already decode is kept
 * as it is; a HEIC one is turned into a JPEG here, in the browser, by a
 * converter that is only loaded when a HEIC photo turns up (it is large).
 */

const HEIC_NAME = /\.(heic|heif)$/i;
const IMAGE_NAME = /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i;

/** True for anything that could be a photo, including HEIC files the OS gave no type. */
export function looksLikePhoto(file: { name: string; type: string }): boolean {
  return file.type.startsWith('image/') || IMAGE_NAME.test(file.name);
}

export function looksLikeHeic(file: { name: string; type: string }): boolean {
  return /image\/hei[cf]/i.test(file.type) || HEIC_NAME.test(file.name);
}

async function browserCanDraw(file: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== 'function') return true;
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close?.();
    return true;
  } catch {
    return false;
  }
}

/** The photo ready for the tray, or an error naming why it can't be used. */
export async function prepareFacePhoto(file: File): Promise<File> {
  if (await browserCanDraw(file)) return file;
  if (!looksLikeHeic(file)) throw new Error(`${file.name} isn't a photo this browser can open.`);
  const { heicTo } = await import('heic-to/csp');
  const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  return new File([jpeg], file.name.replace(HEIC_NAME, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
}
