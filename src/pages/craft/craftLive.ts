/**
 * The one live/draft map for the Craft index, keyed by each row's href.
 *
 * Adrian's rule, 2026-09-22, in his words: nothing in Craft was written by
 * him except the glossary, so visitors get the glossary alone, "a taste", and
 * the other rows appear one at a time as he finishes them. A row not listed
 * here, or listed `false`, is a draft: the owner sees it dimmed and tagged,
 * a visitor does not see it at all. Flip a row to `true` here and it is live
 * in the contents, in the numbering and in the cover rail in one edit.
 *
 * A /read/* row answers to BOTH this map and `articleLive.ts`: it is live in
 * Craft only when Adrian has said so here AND the piece itself is published
 * in Read. That keeps Craft from ever linking a visitor to an article Read
 * would refuse to show them.
 *
 * Import-light on purpose, the same shape as `articleLive.ts`: no React, no
 * store, so a test or an edge function can read the map without pulling in
 * the page.
 */
export const CRAFT_LIVE: Record<string, boolean> = {
  '/read/ritual': false,
  '/read/field-study': false,
  '/read/porcelain-and-tea': false,
  '/read/craft': false,
  '/read/tasting': false,
  '/craft?v=journeys': false,
  '/discover': false,
  '/wisdom': false,
  '/craft?v=glossary': true,
  '/craft?v=course': false,
  '/craft?v=reading': false,
  '/craft?v=spaces': false,
  '/craft?v=wisdom': false,
};
