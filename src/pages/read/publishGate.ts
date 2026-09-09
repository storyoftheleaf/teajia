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
import {
  ARTICLE_LIVE,
  isArticleVisible,
  isReadPathPublic,
  isUngatedReadPath,
  UNGATED_READ_PATHS,
} from './articleLive';
export { ARTICLE_LIVE, isArticleVisible, isReadPathPublic, isUngatedReadPath, UNGATED_READ_PATHS };

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { AUTH_TOKEN_CHANGED_EVENT, getTokenClaims } from '../../lib/api';
import type { AccountMembership } from '../../types';

/**
 * Does this membership make its holder one of the people the drafts belong to.
 *
 * The Read section is Teajia's own magazine, so "owner" here means the Teajia
 * account, never any account. The previous version asked
 * `memberships.some((m) => m.role === 'owner')`, which is true of every curator
 * who owns their OWN shop: this site signs curators in through the same JWT, so
 * a curator with one membership on their own account read every Teajia draft.
 * The over-grant is the same shape as the leak it was written to close, one
 * layer up.
 *
 * The platform account is the one the worker marks: `loadMemberships` sets
 * `is_platform_account` from `accounts.is_platform_owner`, and that account also
 * carries `kind = 'platform'` (acc_teajia_bali, verified against the sandbox
 * database). Either marker answers it; both are read because older tokens may
 * carry only one.
 *
 * Its owner gets in. Its staff get in only with the `publish` bundle, which is
 * the same bundle AdminApp.tsx already requires for editorial work, so a staff
 * member hired to count stock does not inherit the unpublished writing. A
 * viewer never gets in. Roles are the three in `AccountRole`: there is no
 * separate 'admin' account role in this codebase, `staff` is that tier.
 */
function isTeajiaEditor(m: AccountMembership): boolean {
  const onPlatformAccount = m.account_kind === 'platform' || m.is_platform_account === true;
  if (!onPlatformAccount) return false;
  if (m.role === 'owner') return true;
  return m.role === 'staff' && Array.isArray(m.bundles) && m.bundles.includes('publish');
}

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
    if (isDevAdmin) return true;
    const claims = getTokenClaims();
    // Platform tier operates across the whole network and holds every bundle on
    // every account by definition (see selectHasBundle in lib/store.ts), so it
    // is the plainest way for Adrian's own token to answer yes.
    const platformRole = claims?.platform_role;
    if (platformRole === 'platform_owner' || platformRole === 'platform_admin') return true;
    // Otherwise it takes a membership on Teajia's own account. The top-level
    // `role` claim is deliberately NOT consulted any more: it is the users
    // table's own column, every self-registered account gets 'user' there, and
    // the handful of rows carrying 'owner' are legacy seeds that say nothing
    // about which shop the person belongs to.
    return (claims?.memberships ?? []).some(isTeajiaEditor);
  }, [isDevAdmin, tokenRevision]);
}

/** The gate as a hook: is this route visible to whoever is looking at it now. */
export function useArticleAccess(href: string): boolean {
  const isOwner = useIsReadOwner();
  return isArticleVisible(href, isOwner);
}
