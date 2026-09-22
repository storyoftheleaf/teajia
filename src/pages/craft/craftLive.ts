/**
 * The one state map for the Craft index, keyed by each row's own key (not
 * its href, since two rows, Playlists and Brewing by Tea Type, have no href
 * at all yet: they are a promise, not a place).
 *
 * Adrian's rule, 2026-09-22, in his words: "let's look at the six pieces,
 * but I want there to be images and I want it to be something people are
 * interested in... Even if it's coming soon, we have an image of what will
 * be built, then 'coming soon', and in the background the template that
 * displays what we're building, but it doesn't link in, so people don't get
 * into the construction side." That gives Craft three states, not two:
 *
 *   live  - a real row, a real link, numbered in the contents.
 *   soon  - a title, a dek and a photo a visitor can see, with no way in.
 *           The owner still reaches it when it carries an href.
 *   draft - the owner's own workshop. A visitor never sees the row at all.
 *
 * A key missing from this map reads as 'draft', the same fail-closed
 * default as articleLive.ts, so a new row cannot go public by being
 * forgotten. A /read/* row also has to pass isArticleVisible, so Craft can
 * never link a visitor to an article Read itself would refuse to show them.
 *
 * Flip a key here and it moves in one edit: the contents list, the
 * numbering, and the cover rail all read this one map.
 */
export type CraftState = 'live' | 'soon' | 'draft';

export const CRAFT_STATE: Record<string, CraftState> = {
  // Brew
  ritual: 'live',
  'field-study': 'draft',
  porcelain: 'live',
  pot: 'draft',
  'brew-by-type': 'soon',
  // Taste
  tasting: 'live',
  journeys: 'soon',
  discover: 'live',
  // Know
  reference: 'live',
  glossary: 'live',
  foundations: 'soon',
  reading: 'soon',
  // Room
  spaces: 'soon',
  'shared-wisdom': 'soon',
  playlists: 'soon',
};
