import tastingTaxonomy from '../../src/data/teajia-tasting-taxonomy.json';
import type { TastingData } from '../../src/types';

const TASTING_ARRAY_FIELDS = ['body', 'finish', 'feeling', 'flavor', 'liquor-color'] as const;
const TASTING_BOOLEAN_FIELDS = ['huiGan', 'yun', 'qi', 'tangGan'] as const;
const TASTING_FIELDS = new Set<string>([...TASTING_ARRAY_FIELDS, ...TASTING_BOOLEAN_FIELDS, 'clarity']);

const TERM_IDS_BY_CATEGORY = new Map(
  tastingTaxonomy.categories.map(category => [
    category.id,
    new Set(category.groups.flatMap(group => group.terms.map(term => term.id))),
  ]),
);

/**
 * Term id to its written label, e.g. `stone-fruit` to "Stone fruit".
 *
 * A confirmation preview that reads back `hui-gan` and `dried-fruit` is asking
 * a human to approve a claim about a tea in a vocabulary they do not speak.
 * The taxonomy already carries the words; this is the same lookup the shop
 * front uses, kept here so the worker has one source for both.
 */
const TERM_LABELS = new Map<string, string>(
  tastingTaxonomy.categories.flatMap(category =>
    category.groups.flatMap(group => group.terms.map(term => [term.id, term.label] as [string, string])),
  ),
);

/** The written label for a term id, falling back to the id when unknown. */
export function tastingTermLabel(termId: string): string {
  return TERM_LABELS.get(termId) ?? termId;
}

/** The categories a caller may set: the array-valued ones the taxonomy knows. */
export const TASTING_TERM_CATEGORIES = TASTING_ARRAY_FIELDS;

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeImportTasting(value: unknown): TastingData | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { throw new Error('Invalid tasting'); }
  }
  const source = object(value);
  if (!source) throw new Error('Invalid tasting');
  for (const field of Object.keys(source)) {
    if (!TASTING_FIELDS.has(field)) throw new Error(`Invalid tasting field: ${field}`);
  }

  const result: TastingData = {};
  for (const field of TASTING_ARRAY_FIELDS) {
    const terms = source[field];
    if (terms == null) continue;
    if (!Array.isArray(terms) || terms.length > 30) throw new Error(`Invalid tasting.${field}`);
    const allowedTerms = TERM_IDS_BY_CATEGORY.get(field);
    const normalized: string[] = [];
    for (const term of terms) {
      if (typeof term !== 'string' || !term.trim() || term.length > 100) throw new Error(`Invalid tasting.${field}`);
      const termId = term.trim();
      if (!allowedTerms?.has(termId)) throw new Error(`Invalid tasting.${field} term: ${termId}`);
      normalized.push(termId);
    }
    if (normalized.length) result[field] = [...new Set(normalized)] as never;
  }
  for (const field of TASTING_BOOLEAN_FIELDS) {
    const fact = source[field];
    if (fact == null) continue;
    if (typeof fact !== 'boolean') throw new Error(`Invalid tasting.${field}`);
    result[field] = fact;
  }
  if (source.clarity != null) {
    if (source.clarity !== 'clear' && source.clarity !== 'hazy' && source.clarity !== 'cloudy') throw new Error('Invalid tasting.clarity');
    result.clarity = source.clarity;
  }
  return Object.keys(result).length ? result : null;
}

/**
 * Merge a set of tasting categories onto a product's stored tasting.
 *
 * `products.tasting` carries more than the five term categories: the starred
 * notes the product page reads out as quotes, the teaser line, the brewing
 * terms, and the hui gan / yun / qi / tang gan facts. Writing the column from
 * five arrays would delete every one of them silently, so this only replaces
 * the categories a caller actually named.
 *
 * A category supplied as an empty array is a deliberate clear. A category not
 * supplied at all is left exactly as it was.
 *
 * Throws rather than dropping: an unknown term id would otherwise publish a
 * shorter claim than was asked for and say nothing about it, and stored JSON
 * that will not parse would otherwise be merged onto nothing and lost.
 */
export function mergeProductTasting(
  storedRaw: unknown,
  suppliedByCategory: Record<string, string[]>,
): { next: Record<string, unknown>; touched: string[] } {
  const stored = readStoredTasting(storedRaw);
  const touched = Object.keys(suppliedByCategory);

  const toValidate: Record<string, string[]> = {};
  for (const [category, terms] of Object.entries(suppliedByCategory)) {
    if (terms.length) toValidate[category] = terms;
  }
  const validated = (Object.keys(toValidate).length ? normalizeImportTasting(toValidate) : null) ?? {};

  const next: Record<string, unknown> = { ...stored };
  for (const category of touched) {
    const terms = (validated as Record<string, unknown>)[category];
    if (Array.isArray(terms) && terms.length) next[category] = terms;
    else delete next[category];
  }
  return { next, touched };
}

/** Read the stored tasting column, which may be an object, JSON text, or empty. */
export function readStoredTasting(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
  if (typeof raw !== 'string') return {};
  const text = raw.trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Stored tasting is not readable JSON; fix it in the admin before setting terms here.');
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
}

/** True when the merged tasting carries at least one term the shop is claiming. */
export function tastingHasTerms(tasting: Record<string, unknown>): boolean {
  return TASTING_ARRAY_FIELDS.some(category => {
    const value = tasting[category];
    return Array.isArray(value) && value.length > 0;
  });
}
