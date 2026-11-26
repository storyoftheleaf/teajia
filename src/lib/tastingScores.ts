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

function scrub(value: unknown, depth: number): unknown {
  if (depth > 6 || !value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => scrub(item, depth + 1));
  const copy: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SCORE_KEY_SET.has(key)) continue;
    copy[key] = scrub(inner, depth + 1);
  }
  return copy;
}

/**
 * A copy of a tasting without its scores, at any depth, so a list in an old
 * shape (`[{ rating: 8 }]`) loses them as surely as one object does.
 * Anything that is not an object or a list comes back as it was.
 */
export function tastingWithoutScores<T>(tasting: T): T {
  return scrub(tasting, 0) as T;
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
