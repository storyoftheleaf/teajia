/**
 * Same-origin media URLs — mainland-China reachability.
 *
 * Uploaded photos/audio are stored in D1 as canonical `https://media.teajia.co/<key>`
 * URLs. That hostname is GFW-filterable (different-apex subdomain — the same
 * pattern that killed `api.teajia.com`), so in production we render media via
 * the app's own origin instead: `/media/<key>`, served by the Pages Function
 * proxy in `functions/media/[[path]].ts`. Storage stays canonical; only the
 * render-time URL changes.
 *
 * Dev keeps the direct URL — the Vite dev server has no /media proxy.
 */
const MEDIA_HOST_PREFIX = 'https://media.teajia.co/';

export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | undefined;
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (import.meta.env.PROD && url.startsWith(MEDIA_HOST_PREFIX)) {
    return `/media/${url.slice(MEDIA_HOST_PREFIX.length)}`;
  }
  return url;
}
