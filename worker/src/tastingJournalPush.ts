import { mergeJournalSides, type MergeableNote, type MergeableSitting } from '../../src/lib/tastingJournalMerge';

/**
 * A device pushing a tea's journal entry used to replace the stored `note`
 * and `tastings` outright, so a device holding an older copy erased sittings
 * another device had added. The push now joins the two copies with the rule
 * the client uses when it pulls (`src/lib/tastingJournalMerge.ts`).
 *
 * Only `note` and `tastings` are joined. Everything else on the row (the name,
 * the image, `archived`) is still the pushing device's, as before: archiving
 * and restoring are both a push of the flag, so a union would make one of them
 * impossible. When either copy cannot be read as a note and a list of
 * sittings, the pushed text is stored as it came, which is the old behaviour.
 */

interface StoredJournal {
  note: string | null;
  tastings: string | null;
}

type DB = { prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };

function parse(text: unknown): unknown {
  if (typeof text !== 'string') return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

const isNote = (value: unknown): value is MergeableNote =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isSittings = (value: unknown): value is MergeableSitting[] => Array.isArray(value);

/** The `note` and `tastings` text to store for one pushed entry. */
export function mergePushedJournal(stored: StoredJournal | null | undefined, pushed: { note: string; tastings: string }) {
  if (!stored) return pushed;
  const storedNote = parse(stored.note);
  const storedSittings = parse(stored.tastings);
  const pushedNote = parse(pushed.note);
  const pushedSittings = parse(pushed.tastings);
  if (!isNote(storedNote) || !isSittings(storedSittings) || !isNote(pushedNote) || !isSittings(pushedSittings)) {
    return pushed;
  }
  // The pushing device goes first, so it wins a tie.
  const merged = mergeJournalSides(
    { note: pushedNote, tastings: pushedSittings },
    { note: storedNote, tastings: storedSittings },
  );
  return {
    note: merged.firstIsNewer ? pushed.note : (stored.note as string),
    tastings: JSON.stringify(merged.tastings),
  };
}

/** The stored copies a push is about to meet, keyed by product id. */
export async function storedJournalsFor(db: DB, userId: string | null, productIds: string[]) {
  const stored = new Map<string, StoredJournal>();
  const unique = [...new Set(productIds)];
  for (let start = 0; start < unique.length; start += 50) {
    const chunk = unique.slice(start, start + 50);
    const { results } = await db.prepare(
      `SELECT product_id, note, tastings FROM customer_tasting_journal
        WHERE user_id = ? AND product_id IN (${chunk.map(() => '?').join(', ')})`,
    ).bind(userId, ...chunk).all<StoredJournal & { product_id: string }>();
    for (const row of results) stored.set(row.product_id, { note: row.note, tastings: row.tastings });
  }
  return stored;
}
