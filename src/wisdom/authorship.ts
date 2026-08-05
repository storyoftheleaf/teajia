/**
 * Authorship rungs for the wisdom base.
 *
 * Most prose here was AI-drafted from research. That must be visible, never
 * hidden and never apologised for. Three rungs, per docs/TEA_WISDOM_BASE.md:
 *
 *   drafted   published, sourced, not yet read by a human
 *   reviewed  read and corrected, carries a date
 *   authored  Adrian's own words
 *
 * Every entry currently in the base defaults to "drafted", because that is
 * the truth: it was AI-drafted from research and nobody has read it yet.
 */

export const AUTHORSHIP_RUNGS = ['drafted', 'reviewed', 'authored'] as const;
export type AuthorshipRung = typeof AUTHORSHIP_RUNGS[number];

/** A single entry's authorship state. */
export interface Authorship {
  rung: AuthorshipRung;
  /** Who reviewed or authored the entry, when the rung carries a person. */
  reviewer?: string;
  /** The date the rung was reached (ISO, e.g. "2026-07-27"). */
  date?: string;
  /** Sources the entry was drafted or corrected from. */
  sources?: string[];
}

const DEFAULT_AUTHORSHIP: Authorship = { rung: 'drafted' };

/**
 * Rung assignments keyed by entity id (a cultivar id, region id, or variety
 * id). Empty today: nothing in the base has been reviewed or authored yet.
 * Add an entry here the day a record is actually read and corrected, or
 * written in Adrian's own words. Never mark a rung ahead of that happening.
 */
export const AUTHORSHIP: Record<string, Authorship> = {};

/** Looks up an entity's authorship, defaulting to "drafted" for anything not listed. */
export function getAuthorship(id: string | null | undefined): Authorship {
  if (!id) return DEFAULT_AUTHORSHIP;
  return AUTHORSHIP[id] ?? DEFAULT_AUTHORSHIP;
}

/**
 * The one quiet line a page should show for an entity's authorship. Restrained
 * and factual: it neither hides the AI origin nor apologises for it.
 */
export function authorshipLine(id: string | null | undefined): string {
  const entry = getAuthorship(id);
  switch (entry.rung) {
    case 'authored':
      return entry.date
        ? `Written by ${entry.reviewer ?? 'Adrian'}, ${entry.date}.`
        : `Written by ${entry.reviewer ?? 'Adrian'}.`;
    case 'reviewed':
      return entry.date
        ? `Reviewed and corrected by ${entry.reviewer ?? 'Adrian'}, ${entry.date}.`
        : `Reviewed and corrected by ${entry.reviewer ?? 'Adrian'}.`;
    case 'drafted':
    default:
      return 'Drafted from research. Not yet read by a human.';
  }
}
