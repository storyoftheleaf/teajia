/**
 * The one state map for the Advise index, keyed by each ledger row's own key
 * (not its href, since a `soon` row may carry no href for a visitor at all,
 * and two rows share the same owner destination while asking different
 * questions: `journeys` and `projects` both point the owner at
 * `/advise?v=projects`, the one place his unbuilt portfolio work lives).
 *
 * Same shape as Craft's `craftLive.ts`, on purpose: this page is built in
 * the same frame, and Adrian's rule from that page carries over unchanged.
 * Three states, not two:
 *
 *   live  - a real row: either a real link, or a button that opens the
 *           inquiry form with its interest already ticked.
 *   soon  - a title and a short line a visitor can see, with no way in. The
 *           owner still reaches it when it carries a destination.
 *   draft - the owner's own workshop. A visitor never sees the row at all.
 *
 * A key missing from this map reads as 'draft', the same fail-closed default
 * as craftLive.ts and articleLive.ts, so a new row cannot go public by being
 * forgotten.
 *
 * Flip a key here and it moves everywhere in one edit: the sub-ledger under
 * each service, the rail's third secondary cover (Projects), and the coming
 * soon strip all read this one map.
 */
export type AdviseState = 'live' | 'soon' | 'draft';

export const ADVISE_STATE: Record<string, AdviseState> = {
  'for-your-space': 'live',
  projects: 'soon',
  'sourcing-collection': 'live',
  'sourcing-space': 'live',
  journeys: 'soon',
  'open-sit': 'live',
  'practice-setup': 'live',
  'group-ceremonial': 'live',
  'private-events': 'live',
  sessions: 'soon',
};
