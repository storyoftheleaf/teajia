// Shrink a (often huge) phone photo to a web-friendly size before upload, so
// uploads are fast on cell data. Keeps aspect ratio; caps the long edge and
// re-encodes as JPEG. Falls back to the original file if anything goes wrong.
export async function shrinkImage(file: File, maxEdge = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // SVG/GIF: leave as-is (canvas would rasterize / drop animation).
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= maxEdge) { bitmap.close?.(); return file; }
    const scale = maxEdge / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// True on a touch-first device, used to choose touch vs mouse affordances.
export function isTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;
}
