// A short film made smaller on the device before it goes up (Adrian,
// 2026-11-27: "make sure the short film is compressed"). A phone films ten
// seconds at 20 MB or more; a guest on mobile data at a gate needs a tenth of
// that. The film is played once into a canvas no wider than 720 on its long
// side and recorded again as an mp4 with no sound (it plays muted on the way
// in). The worker cannot do this: it has no film encoder.
//
// Only an mp4 is made, because every phone plays one. A browser that cannot
// record an mp4, or any failure on the way, gives back the film as it was.

export const FILM_LONG_SIDE = 720;
export const FILM_BITS_PER_SECOND = 1_200_000;
/** The longest film taken in, in seconds. Showing the way to a house can take a minute (Adrian, 2026-11-27), so a minute and a half is let in; at this size that is about 14 MB. */
export const FILM_MAX_SECONDS = 90;

const MP4_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];

/** The size to draw a film at: its own shape, the long side held to 720, both sides even. */
export function filmFrame(width: number, height: number, longSide = FILM_LONG_SIDE): { width: number; height: number } {
  const scale = Math.min(1, longSide / Math.max(width, height, 1));
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** The mp4 type this browser can record, or null when it records none. */
export function recordableMp4(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  return MP4_TYPES.find(type => { try { return MediaRecorder.isTypeSupported(type); } catch { return false; } }) ?? null;
}

export class FilmTooLong extends Error {
  constructor() { super('Keep a film under a minute and a half.'); }
}

/**
 * The film, smaller. Answers the file it was given when this browser cannot
 * make it smaller or the smaller one came out no smaller. Throws FilmTooLong
 * for a film over a minute and a half, and nothing else.
 */
export async function compressFilm(file: File, onProgress?: (done: number) => void): Promise<File> {
  const type = recordableMp4();
  if (!type) return file;
  const address = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
      video.src = address;
    });
    if (Number.isFinite(video.duration) && video.duration > FILM_MAX_SECONDS) throw new FilmTooLong();
    if (!video.videoWidth || !video.videoHeight) return file;

    const frame = filmFrame(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: FILM_BITS_PER_SECOND });
    const parts: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
    const recorded = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('recorder'));
    });

    let drawing = true;
    const draw = () => {
      if (!drawing) return;
      context.drawImage(video, 0, 0, frame.width, frame.height);
      if (onProgress && Number.isFinite(video.duration) && video.duration > 0) onProgress(Math.min(1, video.currentTime / video.duration));
      const next = (video as HTMLVideoElement & { requestVideoFrameCallback?: (run: () => void) => number }).requestVideoFrameCallback;
      if (next) next.call(video, draw); else requestAnimationFrame(draw);
    };
    const played = new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error('playback'));
    });
    // A film that stalls (a tab put away, a file the player gives up on) is sent as it was.
    const limit = (Number.isFinite(video.duration) ? video.duration : FILM_MAX_SECONDS) * 3000 + 15_000;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, reject) => { stallTimer = setTimeout(() => reject(new Error('stalled')), limit); });
    stalled.catch(() => undefined);

    recorder.start(1000);
    await video.play();
    draw();
    try {
      await Promise.race([played, stalled]);
    } finally {
      clearTimeout(stallTimer);
      drawing = false;
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }
    await recorded;

    const smaller = new Blob(parts, { type: 'video/mp4' });
    if (!smaller.size || smaller.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'film'}.mp4`;
    return new File([smaller], name, { type: 'video/mp4' });
  } catch (failure) {
    if (failure instanceof FilmTooLong) throw failure;
    return file;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(address);
  }
}
