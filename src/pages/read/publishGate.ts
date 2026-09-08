/**
 * The one publish gate every /read/* article route obeys.
 *
 * Before this file existed, `ReadIndex.tsx` was the only place that knew
 * which pieces were live: a `live?: boolean` flag sat on each row of its own
 * contents list, read only to decide what a visitor's index shows. The
 * fourteen article page components had no gate of their own, so a route with
 * no `live` flag was still fully public at its own URL. An anonymous visitor
 * with empty storage could read the entire Rock Remembers interview at
 * /read/rock-remembers even though the index never lists it for them.
 * (JOBC-2, prime-time audit 2026-09.)
 *
 * `ARTICLE_LIVE` is now the single map both ReadIndex's contents list and
 * every article route check. Flip a route to `true` here and it becomes
 * visible to a visitor everywhere: the index and the direct URL together,
 * with one edit.
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

import { useMemo } from 'react';
import { useAppStore } from '../../lib/store';
import { getTokenClaims } from '../../lib/api';

/**
 * Real login, never a demo toggle, moved here from ReadIndex.tsx (which had
 * the only copy). Reads the signed-in role straight from the stored token's
 * claims: this works on the standalone Read pages, which never run the admin
 * login flow, so the store's platformRole isn't populated there, and it has
 * no hydration-timing race. The dev-admin toggle stays as a fallback for
 * local development.
 */
export function useIsReadOwner(): boolean {
  const isDevAdmin = useAppStore((s) => s.isDevAdmin);
  return useMemo(() => {
    const claims = getTokenClaims();
    // Top-level `role` is the legacy field; current JWTs carry the real role
    // inside `memberships[].role`, so check both. Any owner/admin membership
    // (or platform owner/admin) unlocks the drafts.
    const topRole = claims?.role;
    const platformRole = claims?.platform_role;
    const memberRole = (claims?.memberships ?? []).some(
      (m) => m.role === 'owner',
    );
    return (
      topRole === 'owner' ||
      topRole === 'admin' ||
      memberRole ||
      platformRole === 'platform_owner' ||
      platformRole === 'platform_admin' ||
      isDevAdmin
    );
  }, [isDevAdmin]);
}

/** The gate as a hook: is this route visible to whoever is looking at it now. */
export function useArticleAccess(href: string): boolean {
  const isOwner = useIsReadOwner();
  return isArticleVisible(href, isOwner);
}
