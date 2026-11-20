import type { SquarePhotoFrame } from './cropImage';

/**
 * What the photo editor made a picture from, kept for this sitting. A record
 * that stores only a picture's address (a person's portrait, a gallery photo)
 * has nowhere to keep the untouched original, so the editor would otherwise
 * reopen on the already-cropped picture. With this, opening it again in the
 * same sitting starts from the original, exactly where it was left.
 */
const edits = new Map<string, { original: string; frame: SquarePhotoFrame }>();

export function rememberPhotoEdit(edited: string, original: string, frame: SquarePhotoFrame): void {
  edits.set(edited, { original, frame });
}

export function recallPhotoEdit(url: string | null | undefined): { original: string; frame: SquarePhotoFrame } | undefined {
  return url ? edits.get(url) : undefined;
}
