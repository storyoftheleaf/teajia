import { inspectJpeg } from './familyJpeg';

/**
 * Copy JPEG frame and scan data, dropping all application segments and comments.
 * Walk through every scan, including progressive JPEGs, so metadata cannot
 * survive between scans. The stored private photo is never rewritten.
 */
export function publicSitPhotoJpeg(input: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (!inspectJpeg(input).ok) return null;

  const output = new Uint8Array(input.length);
  output.set(input.subarray(0, 2));
  let written = 2;
  let offset = 2;
  let scanning = false;
  const copy = (start: number, end: number) => {
    output.set(input.subarray(start, end), written);
    written += end - start;
  };

  while (offset < input.length) {
    if (scanning) {
      const start = offset;
      for (; offset < input.length; offset++) {
        if (input[offset] !== 0xff) continue;
        let markerOffset = offset + 1;
        while (input[markerOffset] === 0xff) markerOffset++;
        const code = input[markerOffset];
        if (code !== 0 && !(code >= 0xd0 && code <= 0xd7)) break;
        offset = markerOffset;
      }
      copy(start, offset);
      scanning = false;
    }

    const start = offset;
    if (input[offset++] !== 0xff) return null;
    while (input[offset] === 0xff) offset++;
    const marker = input[offset++];
    if (marker === 0xd9) {
      if (offset !== input.length) return null;
      copy(start, offset);
      return output.subarray(0, written);
    }
    if (marker < 0xc0 || marker > 0xfe || (marker >= 0xd0 && marker <= 0xd8)) return null;
    const length = (input[offset] << 8) | input[offset + 1];
    if (length < 2 || offset + length > input.length) return null;
    offset += length;

    if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)) copy(start, offset);
    if (marker === 0xda) scanning = true;
  }
  return null;
}
