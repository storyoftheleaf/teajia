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
 * The Read paths that are public for everyone while sitting outside the
 * curated index, so `ARTICLE_LIVE` has no opinion about them.
 *
 * `/read` is the index itself. `/read/leaf-to-liquor` is the Art of Tea
 * flagship that predates the index; its `:template` child resolves to five
 * layout names rather than to an article, so neither was ever a candidate for
 * `ARTICLE_LIVE`. This list used to be typed separately into
 * publishGate.test.ts and read implicitly by the middleware's own
 * `hasOwnProperty` check, which is two more copies of one fact than the
 * shipped code should carry. Every caller reads this one now: the rail filter,
 * the route sweep and the crawler-meta gate agree by construction rather than
 * by three authors remembering the same two paths.
 *
 * Nothing else belongs here. A route earns a place only by being the same kind
 * of pre-existing exception, never by being forgotten.
 */
export const UNGATED_READ_PATHS: readonly string[] = ['/read', '/read/leaf-to-liquor'];

/** Is this one of the named public-but-uncurated Read paths. */
export function isUngatedReadPath(path: string): boolean {
  return UNGATED_READ_PATHS.includes(path) || path.startsWith('/read/leaf-to-liquor/');
}

/**
 * Is this one of the curated pieces the map lists, and so a path whose state
 * Adrian may change from the page. The worker refuses a publish or unpublish
 * for anything else, and a stored state is ignored for anything else, so a
 * stray row can never make public a route the map has never heard of.
 */
export function isCuratedReadPath(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(ARTICLE_LIVE, path);
}

/**
 * A piece's state as Adrian set it on the page: the Publish and Unpublish
 * buttons at the end of a story, stored by the worker in read_publish_state
 * (migration 0030) and served at /api/public/read/publish-state. One row per
 * path, and a row wins over the map in BOTH directions: 'live' publishes a
 * draft, 'draft' takes a live piece back down. A path with no row is decided
 * by ARTICLE_LIVE exactly as before, so the map stays the default and nothing
 * live today changes until somebody presses a button.
 *
 * A caller that cannot reach the stored states (a failed fetch, the edge with
 * the API down) passes nothing and gets the map: a bad minute falls back to
 * what the code says, never to "everything hidden".
 */
export type ReadPublishState = 'live' | 'draft';
export type ReadPublishOverrides = Readonly<Record<string, ReadPublishState>>;

/** The stored state for one path, or undefined when the map decides. */
export function readOverrideFor(path: string, overrides?: ReadPublishOverrides | null): ReadPublishState | undefined {
  if (!overrides || !isCuratedReadPath(path)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(overrides, path)) return undefined;
  const state = overrides[path];
  return state === 'live' || state === 'draft' ? state : undefined;
}

/**
 * May a visitor see this Read path. Fails closed: a path neither marked live
 * nor named as an exception is a draft, whether it is a piece somebody forgot
 * to add to the map or a route that does not exist at all. A state stored from
 * the page overrides the map for a curated path (see ReadPublishOverrides).
 */
export function isReadPathPublic(path: string, overrides?: ReadPublishOverrides | null): boolean {
  if (isUngatedReadPath(path)) return true;
  const stored = readOverrideFor(path, overrides);
  if (stored) return stored === 'live';
  return ARTICLE_LIVE[path] === true;
}

/**
 * The gate decision, kept as a plain function so it can be tested without
 * rendering React or touching storage: an owner or editor sees every route,
 * live or not, because the drafts are theirs to work on; a visitor sees only
 * a path `isReadPathPublic` allows.
 *
 * Every surface that NAMES an article answers this one question, so that a
 * piece flipped live here becomes visible everywhere in a single edit: the
 * route itself (ArticleGate), the contents index, the "More from The Art of
 * Tea" rail at the foot of each piece, and the crawler-facing <head> meta the
 * Pages function writes. The rail was the surface this missed on the first two
 * passes: a live page kept advertising three drafts by title and blurb, and
 * clicking one landed the reader on the not-found page the gate had just
 * started serving.
 */
export function isArticleVisible(href: string, isOwner: boolean, overrides?: ReadPublishOverrides | null): boolean {
  if (isOwner) return true;
  return isReadPathPublic(href, overrides);
}
