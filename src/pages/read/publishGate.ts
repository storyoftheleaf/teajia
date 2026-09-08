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
 * with one edit. The map itself lives in `articleLive.ts`, dependency-free,
 * so `functions/_middleware.ts` (the edge function that writes crawler-facing
 * <head> meta) can read the same map without pulling React and the token
 * store into a Workers-runtime bundle; this file re-exports it so every
 * existing caller here keeps working unchanged.
 */
import { ARTICLE_LIVE, isArticleVisible } from './articleLive';
export { ARTICLE_LIVE, isArticleVisible };

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { AUTH_TOKEN_CHANGED_EVENT, getTokenClaims } from '../../lib/api';

/**
 * Real login, never a demo toggle, moved here from ReadIndex.tsx (which had
 * the only copy). Reads the signed-in role straight from the stored token's
 * claims: this works on the standalone Read pages, which never run the admin
 * login flow, so the store's platformRole isn't populated there, and it has
 * no hydration-timing race. The dev-admin toggle stays as a fallback for
 * local development.
 *
 * `tokenRevision` listens for `AUTH_TOKEN_CHANGED_EVENT` (the same signal
 * every other token-reading component in this codebase watches, see
 * SettlementLedger.tsx, OrdersView.tsx, useCompassSync.ts) and forces the
 * memo to recompute. Without it, a token arriving after this hook first
 * mounts, such as the Google OAuth return that writes `#oauth_token=` on
 * load, never unlocks a draft: `isDevAdmin` is the only dependency, it does
 * not change when `setToken` runs, so a visitor who has just signed in as
 * the owner keeps seeing ReadNotFound until some unrelated re-render bumps
 * that dependency. Fails closed rather than leaking a draft, but still a
 * real bug on the owner's own workflow.
 */
export function useIsReadOwner(): boolean {
  const isDevAdmin = useAppStore((s) => s.isDevAdmin);
  const [tokenRevision, setTokenRevision] = useState(0);
  useEffect(() => {
    const onTokenChange = () => setTokenRevision((value) => value + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onTokenChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onTokenChange);
  }, []);
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
  }, [isDevAdmin, tokenRevision]);
}

/** The gate as a hook: is this route visible to whoever is looking at it now. */
export function useArticleAccess(href: string): boolean {
  const isOwner = useIsReadOwner();
  return isArticleVisible(href, isOwner);
}
