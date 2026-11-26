/**
 * A score is personal (Adrian, 2026-11-26). A person may rate a tea for
 * themselves, but the number, and the verdict word that stands for it, is
 * shown to nobody but the person who gave it. Words travel; scores do not.
 *
 * These are the keys a tasting object can carry that are a score: the
 * numbers, old and new, and the one-word verdicts that rank a tea.
 */
export const TASTING_SCORE_KEYS = [
  'quality', 'rating', 'aromaRating', 'finishRating', 'impression', 'verdict',
] as const;

const SCORE_KEY_SET = new Set<string>(TASTING_SCORE_KEYS);

const MAX_DEPTH = 6;

/** What stands in for a list or object deeper than the scrubber reads: nothing. */
const UNEXAMINED = Symbol('unexamined');

function scrub(value: unknown, depth: number): unknown {
  if (!value || typeof value !== 'object') return value;
  // Deeper than this is not read, so it is not passed on either: a score
  // buried below the limit must not come back unexamined.
  if (depth > MAX_DEPTH) return UNEXAMINED;
  if (Array.isArray(value)) return value.map(item => scrub(item, depth + 1)).filter(item => item !== UNEXAMINED);
  const copy: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SCORE_KEY_SET.has(key)) continue;
    const kept = scrub(inner, depth + 1);
    if (kept !== UNEXAMINED) copy[key] = kept;
  }
  return copy;
}

/**
 * A copy of a tasting without its scores, so a list in an old shape
 * (`[{ rating: 8 }]`) loses them as surely as one object does. Lists and
 * objects nested deeper than the scrubber reads are dropped, not passed on.
 * Anything that is not an object or a list comes back as it was.
 */
export function tastingWithoutScores<T>(tasting: T): T {
  const scrubbed = scrub(tasting, 0);
  return (scrubbed === UNEXAMINED ? null : scrubbed) as T;
}

/** A JSON text of a tasting, read and written back without its scores. Unreadable text comes back as null. */
export function tastingJsonWithoutScores(text: unknown): string | null {
  if (typeof text !== 'string' || !text) return null;
  try { return JSON.stringify(tastingWithoutScores(JSON.parse(text))); } catch { return null; }
}

/** The score keys of a tasting object, alone. Used to keep a giver's score when someone else saves the words. */
export function tastingScoresOnly(tasting: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!tasting || typeof tasting !== 'object' || Array.isArray(tasting)) return out;
  for (const key of TASTING_SCORE_KEYS) {
    if (key in (tasting as Record<string, unknown>)) out[key] = (tasting as Record<string, unknown>)[key];
  }
  return out;
}
