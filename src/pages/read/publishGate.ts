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
  type ReadPublishOverrides,
} from './articleLive';
export { ARTICLE_LIVE, isArticleVisible, isReadPathPublic, isUngatedReadPath, UNGATED_READ_PATHS };

import { useEffect, useSyncExternalStore } from 'react';
import { useAppStore } from '../../lib/store';
import { getReadEditor, loadReadEditor, subscribeReadEditor } from './readEditorState';
import {
  getReadPublishSnapshot,
  loadReadPublishState,
  subscribeReadPublishState,
  type ReadPublishSnapshot,
} from './readPublishState';

/**
 * The stored states Adrian set from the page (Publish / Unpublish), read once
 * per page load. Until the read settles `settled` is false; after a failure it
 * is true with no states, so the map decides. Every surface that names a story
 * passes `states` to `isArticleVisible`, so one press reaches all of them.
 */
export function useReadPublishState(): ReadPublishSnapshot {
  const snap = useSyncExternalStore(subscribeReadPublishState, getReadPublishSnapshot, getReadPublishSnapshot);
  useEffect(() => { void loadReadPublishState(); }, []);
  return snap;
}

/**
 * The stored states this page already knows, WITHOUT asking the API. For the
 * surfaces outside /read that list a Read story (Craft, a person's page): they
 * honour a press as soon as this browser has read the states, and otherwise
 * fall back to the map, rather than adding a request to every page they render.
 */
export function useKnownReadOverrides(): ReadPublishOverrides {
  return useSyncExternalStore(subscribeReadPublishState, getReadPublishSnapshot, getReadPublishSnapshot).states;
}

/** The browser displays editor controls only after a verified server grant.
 * Native module requests use the HttpOnly session established by that grant;
 * the delivery Function checks authorization again for every module request.
 */
export function useIsReadOwner(): boolean {
  const isDevAdmin = useAppStore((s) => s.isDevAdmin);
  const editor = useSyncExternalStore(subscribeReadEditor, getReadEditor, () => false);
  useEffect(() => { void loadReadEditor(); }, []);
  return (import.meta.env.DEV && isDevAdmin) || editor;
}

/**
 * The gate as a hook: is this route visible to whoever is looking at it now.
 *
 * 'pending' while a visitor's stored states are still being read: the map
 * alone cannot answer, because a row may have published a draft or taken a
 * live story down, so the route waits on its loader rather than flashing the
 * wrong page. The read is bounded and settles to the map on failure. The
 * owner sees every route anyway and never waits.
 */
export function useArticleAccess(href: string): boolean | 'pending' {
  const isOwner = useIsReadOwner();
  const { states, settled } = useReadPublishState();
  if (isOwner) return true;
  if (!settled) return 'pending';
  return isArticleVisible(href, false, states);
}
