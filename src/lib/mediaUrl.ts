/**
 * Same-origin media URLs, mainland-China reachability + no external bucket domain.
 *
 * Uploaded photos/audio are stored in D1 as canonical `https://media.teajia.co/<key>`
 * URLs, but that bucket hostname no longer resolves (the R2 custom domain was
 * removed / never re-provisioned), so every image on the site broke. We now serve
 * media straight from the app's own origin: `/api/media/<key>`, backed by the
 * worker's MEDIA_BUCKET R2 binding (see the `/api/media/` handler in
 * `worker/src/index.ts`). Storage stays canonical in D1; only the render-time URL
 * changes. Riding the app origin also keeps images reachable in China, where the
 * different-apex media subdomain was GFW-filterable.
 */
const MEDIA_HOST_PREFIX = 'https://media.teajia.co/';

// The same base the API client resolves (mirrors src/lib/api.ts): production
// serves same-origin (reachable in China via the Pages /api proxy); dev targets
// the workers.dev API through VITE_API_URL. Kept inline to avoid importing the
// heavy api module into this leaf util.
const API_BASE = import.meta.env.PROD
  ? (typeof window !== 'undefined' ? window.location.origin : 'https://www.teajia.com')
  : (import.meta.env.VITE_API_URL || '');

export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | undefined;
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith(MEDIA_HOST_PREFIX)) {
    // Preserve any `?v=` cache-buster on the tail; the worker parses the key
    // from the path and ignores the query.
    return `${API_BASE}/api/media/${url.slice(MEDIA_HOST_PREFIX.length)}`;
  }
  return url;
}
