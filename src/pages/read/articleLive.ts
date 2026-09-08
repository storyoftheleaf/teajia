/**
 * The one live/draft map for every curated /read/* article, and nothing
 * else: no React, no store, no api client. Two callers read this file for
 * two different reasons and neither should have to pull in the other's
 * dependencies to get it.
 *
 * `publishGate.ts` re-exports `ARTICLE_LIVE` for the app's own gate (the
 * React route wrapper and the owner-login check live there instead, since
 * those need React and the token store). `functions/_middleware.ts`, the
 * Cloudflare Pages edge function that writes crawler-facing <head> meta,
 * imports this file directly: it runs in the Workers runtime, not a
 * browser, so a module carrying React hooks and a localStorage read would
 * be the wrong thing to pull into it even though nothing in that chain
 * would literally break the edge bundle at import time. One map, kept
 * import-light on purpose so both sides can read it without a second copy
 * drifting out of step, which is exactly how a draft's title, description
 * and og:* tags were reaching crawlers for every one of the ten unpublished
 * pieces before this file existed (JOBC-2, prime-time audit 2026-09).
 *
 * A route not listed here is NOT live for a visitor: an entry has to say
 * `true` on purpose, unlisted or `false` both read as draft. `/read/leaf-to-
 * liquor`, the one Art of Tea piece that predates this contents index, is
 * deliberately outside this map and outside the gate entirely: it has always
 * been the site's published flagship read and was never one of the fourteen
 * pieces the index curates.
 */
export const ARTICLE_LIVE: Record<string, boolean> = {
  '/read/ritual': true,
  '/read/atlas': true,
  '/read/history': false,
  '/read/tasting': true,
  '/read/rock-remembers': false,
  '/read/earth-water-fire': false,
  '/read/tea-house': false,
  '/read/porcelain-and-tea': true,
  '/read/before-the-mist': false,
  '/read/essay': false,
  '/read/field-notes': false,
  '/read/field-study': false,
  '/read/legend': false,
  '/read/craft': false,
};

/**
 * The gate decision, kept as a plain function so it can be tested without
 * rendering React or touching storage: an owner or editor sees every route,
 * live or not, because the drafts are theirs to work on; a visitor sees only
 * a route this map marks `true`.
 */
export function isArticleVisible(href: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  return ARTICLE_LIVE[href] === true;
}
