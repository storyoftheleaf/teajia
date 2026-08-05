import { NAMED_TEAS } from './generated/namedTeas';
import type { NamedTea } from './types';

export { NAMED_TEAS };

/**
 * Teas known by the name they were given rather than by a place or a grade.
 *
 * A collector in mainland China stores a sheng for years and names it Courage.
 * The mountain is never recorded, the vintage often is not either, and the tea
 * moves on carrying only that word. The base holds these because the name is
 * genuinely what the tea is, and saying so plainly is better than reporting
 * nothing and calling it rigour.
 */

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, '');

const BY_ID = new Map(NAMED_TEAS.map(entry => [entry.id, entry]));

export const findNamedTeaById = (id: string | null | undefined): NamedTea | null =>
  (id ? BY_ID.get(id) ?? null : null);

/**
 * Matched on the whole name, not on containment.
 *
 * These names are ordinary words. "Courage" inside a longer sentence is not a
 * reference to this tea, and "Universe" would otherwise swallow anything
 * mentioning it. A given name identifies a tea only when it is the name.
 */
const EXACT_INDEX = new Map<string, NamedTea>();
for (const tea of NAMED_TEAS) {
  for (const alias of [tea.name, tea.chineseName, ...tea.altNames]) {
    if (alias) EXACT_INDEX.set(matchKey(alias), tea);
  }
}

export function matchNamedTea(...names: Array<string | null | undefined>): NamedTea | null {
  for (const name of names) {
    if (!name?.trim()) continue;
    const found = EXACT_INDEX.get(matchKey(name));
    if (found) return found;
  }
  return null;
}

/** The naming practices represented, for a reader who wants the tradition itself. */
export const NAMING_TRADITIONS: string[] =
  [...new Set(NAMED_TEAS.map(tea => tea.tradition).filter((value): value is string => Boolean(value)))].sort();

/** Named teas belonging to one practice. */
export const namedTeasInTradition = (tradition: string): NamedTea[] =>
  NAMED_TEAS.filter(tea => tea.tradition === tradition);
