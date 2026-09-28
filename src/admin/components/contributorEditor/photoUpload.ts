import { useCallback, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { shrinkImage } from '../../../pages/read/imageUtils';

/** What the upload endpoint accepts (worker validateUpload). Anything else is re-encoded first. */
const SENDABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** A focal point as the page applies it: CSS object-position, two percentages. */
export type Focus = { x: number; y: number };

export function focusToCss(focus: Focus): string {
  return `${Math.round(focus.x * 10) / 10}% ${Math.round(focus.y * 10) / 10}%`;
}

export function cssToFocus(value: string | null | undefined): Focus {
  const match = (value ?? '').match(/^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return { x: 50, y: 50 };
  return { x: Math.min(100, Number(match[1])), y: Math.min(100, Number(match[2])) };
}

/** The first image in a drop or a paste, or every image when `all` is set. */
export function imagesFrom(list: DataTransferItemList | FileList | null | undefined, all = false): File[] {
  if (!list) return [];
  const files: File[] = [];
  for (const entry of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file && (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))) files.push(file);
    if (files.length && !all) break;
  }
  return files;
}

/**
 * A phone photo made ready to send: shrunk to a web size, and re-encoded as
 * JPEG when it arrived in a format the server will not take (HEIC from an
 * iPhone file share, for one). Throws a sentence a person can act on when the
 * browser cannot read the file at all.
 */
export async function preparePhoto(file: File): Promise<File> {
  const small = await shrinkImage(file);
  if (SENDABLE.has(small.type)) return small;
  try {
    const bitmap = await createImageBitmap(small);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('encode');
    return new File([blob], `${small.name.replace(/\.\w+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
  } catch {
    throw new Error('This browser cannot open that photo. Save it as a JPEG and try again, or choose it from Photos on the phone, which converts it.');
  }
}

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number; preview: string }
  | { status: 'failed'; message: string };

/**
 * One photo on its way to the shop's media store. Shows the chosen file at
 * once (a local preview) so the frame never sits empty while it travels, and
 * keeps the last file so a failure can be retried with one tap.
 */
export function usePhotoUpload(onUploaded: (url: string) => void) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const lastFile = useRef<File | null>(null);
  const preview = useRef<string | null>(null);

  const upload = useCallback(async (file: File) => {
    lastFile.current = file;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    setState({ status: 'uploading', progress: 0.02, preview: preview.current });
    try {
      const ready = await preparePhoto(file);
      const url = await api.uploadImageProgress(ready, progress => {
        setState(current => current.status === 'uploading' ? { ...current, progress: Math.max(0.05, Math.min(0.98, progress)) } : current);
      }, { filename: ready.name || 'photo.jpg' });
      onUploaded(url);
      setState({ status: 'idle' });
    } catch (caught) {
      const message = caught instanceof Error && caught.message.startsWith('This browser')
        ? caught.message
        : 'The photo did not arrive. Check the connection and try again.';
      setState({ status: 'failed', message });
    }
  }, [onUploaded]);

  const retry = useCallback(() => { if (lastFile.current) void upload(lastFile.current); }, [upload]);
  const dismiss = useCallback(() => setState({ status: 'idle' }), []);

  return { state, upload, retry, dismiss };
}
