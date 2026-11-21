/**
 * Reads just enough of a JPEG to decide whether the family upload door takes it.
 *
 * Workers cannot resize or re-encode a picture, so the phone makes both sizes
 * and re-encodes them (src/lib/familyPhotographSizes.ts). The door's job is to
 * refuse anything that did not come out of that step: a file that is not a
 * JPEG, one whose size does not match what it claims, and one that still
 * carries an APP1 segment. APP1 is where Exif and XMP live, and with them the
 * location a phone writes into a photograph. A canvas re-encode never writes
 * one, so its presence means the file was sent untouched.
 *
 * Only the headers before the first scan are walked; the picture data is not
 * decoded.
 */

export type JpegInspection =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: 'not_jpeg' | 'truncated' | 'carries_metadata' | 'no_dimensions' };

/** Start-of-frame markers that carry the picture's height and width. C4, C8 and CC are not frames. */
function isStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

export function inspectJpeg(bytes: Uint8Array): JpegInspection {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { ok: false, reason: 'not_jpeg' };
  let width = 0;
  let height = 0;
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return { ok: false, reason: 'truncated' };
    // Fill bytes: any number of 0xFF may precede a marker.
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return { ok: false, reason: 'truncated' };
    const marker = bytes[offset];
    offset += 1;
    // Markers with no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break;
    if (offset + 2 > bytes.length) return { ok: false, reason: 'truncated' };
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return { ok: false, reason: 'truncated' };
    if (marker === 0xe1) return { ok: false, reason: 'carries_metadata' };
    if (isStartOfFrame(marker)) {
      if (length < 7) return { ok: false, reason: 'truncated' };
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
    }
    // Start of scan: the headers are over, the compressed picture follows.
    if (marker === 0xda) break;
    offset += length;
  }
  if (!width || !height) return { ok: false, reason: 'no_dimensions' };
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return { ok: false, reason: 'truncated' };
  return { ok: true, width, height };
}
