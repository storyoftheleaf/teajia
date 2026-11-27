// A short film of one step of the way in (Adrian, 2026-11-27: the way in may
// carry "videos and pictures"). It is kept under venue-guide/ beside the step
// photographs, so every rule of a step photograph holds for it: served only
// by a signed address, to a seat that may still see the way or to its host
// (wayMedia.ts), and never from a shared cache.

export const MAX_WAY_FILM_BYTES = 25 * 1024 * 1024;

const FILM_EXTENSIONS: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

/** A media key that names a film, so the media door answers a byte range for it. */
export const WAY_FILM_KEY = /^accounts\/[^/]+\/venue-guide\/[A-Za-z0-9._-]+\.(?:mp4|mov|webm)$/;

/** The file ending a film of this type is kept under, or null for any other type. */
export function wayFilmExtension(type: string): string | null {
  return FILM_EXTENSIONS[type.split(';', 1)[0].trim()] ?? null;
}

/**
 * Why a file is not a film this door keeps, or null when it is one. `head` is
 * the file's first 16 bytes: an mp4 or a phone's mov carries `ftyp` at byte 4,
 * a webm opens with the EBML mark.
 */
export function wayFilmRefusal(type: string, size: number, head: Uint8Array): { status: number; error: string; code: string } | null {
  if (size > MAX_WAY_FILM_BYTES) return { status: 413, error: 'Keep a film under 25 MB: about ten seconds from a phone.', code: 'way_film_too_large' };
  const extension = wayFilmExtension(type);
  if (!extension) return { status: 415, error: 'A film is an mp4, a mov or a webm.', code: 'way_film_type' };
  const ascii = String.fromCharCode(...head.slice(0, 12));
  const valid = extension === 'webm'
    ? [0x1a, 0x45, 0xdf, 0xa3].every((byte, index) => head[index] === byte)
    : ascii.slice(4, 8) === 'ftyp';
  return valid ? null : { status: 415, error: 'That file is not a film.', code: 'way_film_type' };
}

/** The part of a film a `Range: bytes=a-b` header asks for, or null when it asks for none that can be read. */
export function wayFilmRange(header: string | null, size: number): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header ?? '').trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  if (!match[1]) {
    const suffix = Math.min(Number(match[2]), size);
    return suffix > 0 ? { offset: size - suffix, length: suffix } : null;
  }
  const offset = Number(match[1]);
  if (offset >= size) return null;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return end >= offset ? { offset, length: end - offset + 1 } : null;
}
