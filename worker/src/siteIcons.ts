/**
 * The Teajia emblem as the API's icon.
 *
 * The icons themselves live on the site (public/, built by
 * scripts/build-icons.py). The API host only points at them, so a favicon
 * lookup on api.teajia.com, which is where an MCP client meets this shop,
 * finds the same emblem the browser tab shows. Nothing here reads the
 * database: an icon must still answer while D1 is resting.
 */

const SITE = 'https://teajia.com';

/** Icon paths a browser or a favicon lookup asks any host for. */
const ICON_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon-192.png',
  '/icon-512.png',
]);

/** A redirect to the site's copy of the icon, or null for any other path. */
export function siteIconRedirect(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const path = new URL(request.url).pathname;
  if (!ICON_PATHS.has(path)) return null;
  const file = path === '/apple-touch-icon-precomposed.png' ? '/apple-touch-icon.png' : path;
  // favicon.svg replaced an older file of the same name, which Cloudflare's
  // edge kept serving; the same token as index.html reaches the new one.
  const version = file === '/favicon.svg' ? '?v=emblem' : '';
  return new Response(null, {
    status: 301,
    headers: { Location: `${SITE}${file}${version}`, 'Cache-Control': 'public, max-age=86400' },
  });
}

/** The emblem for MCP `serverInfo.icons` (MCP 2025-11-25 Implementation icons). */
export const MCP_SERVER_ICONS = [
  { src: `${SITE}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] },
  { src: `${SITE}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] },
  { src: `${SITE}/favicon-32x32.png`, mimeType: 'image/png', sizes: ['32x32'] },
];

export const MCP_SERVER_WEBSITE = SITE;
