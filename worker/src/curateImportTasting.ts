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
