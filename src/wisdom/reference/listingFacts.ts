// Recorded product facts for the Tea Wisdom listing resolver.
// Contract: docs/_notes/tea-wisdom-claims.md, "What a listing may match on".
import type { ListingFacts } from './claims';
import { namedTeaIdForLot } from './namedTeaLots';
import { normalizedWords } from './catalogue';
import { normalizeTeaForm, normalizeTeaType } from '../vocabulary';

/**
 * The only product fields a listing may match on. `grade` exists only on
 * fixtures today: no product row carries a grade, and a grade is never read
 * from a name or description.
 */
export interface ListingFactsSource {
  id?: string | null;
  type?: string | null;
  form?: string | null;
  /** Comma-separated recorded origin, e.g. "Mengsong, Menghai, Yunnan". */
  originRegion?: string | null;
  /** The product's own name. Corroborates a recorded place, never supplies one. */
  name?: string | null;
  /** Explicit leaf_grade page id. Fixtures only. */
  grade?: string | null;
}

function words(value: string | null | undefined): string[] {
  return normalizedWords(value ?? '').split(' ').filter(Boolean);
}

export function listingFacts(product: ListingFactsSource): ListingFacts {
  const type = normalizeTeaType(product.type) ?? undefined;
  const form = normalizeTeaForm(product.form) ?? undefined;
  const namedTeaId = product.id ? namedTeaIdForLot(product.id) : undefined;
  const grade = product.grade?.trim() || undefined;
  const originParts = (product.originRegion ?? '')
    .split(',')
    .map(part => normalizedWords(part))
    .filter(Boolean);
  return {
    ...(namedTeaId ? { namedTeaId } : {}),
    ...(type ? { type } : {}),
    ...(grade ? { grade } : {}),
    originParts,
    nameTokens: words(product.name),
    ...(form ? { form } : {}),
  };
}

/** From the public API shape: `originRegion` is the region field alone. */
export function listingFactsFromPublicProduct(product: {
  id?: string | null;
  type?: string | null;
  form?: string | null;
  originRegion?: string | null;
  productName?: string | null;
}): ListingFacts {
  return listingFacts({
    id: product.id,
    type: product.type,
    form: product.form,
    originRegion: product.originRegion,
    name: product.productName,
  });
}

/**
 * From the shop's InventoryItem. Its `origin` is region and country joined,
 * so the country arrives as one extra whole part ("china"); whole-part
 * matching is unaffected. Never sets a grade.
 */
export function listingFactsFromInventoryItem(item: {
  id?: string | null;
  type?: string | null;
  form?: string | null;
  origin?: string | null;
  variant?: string | null;
  name?: string | null;
}): ListingFacts {
  return listingFacts({
    id: item.id,
    type: item.type,
    form: item.form,
    originRegion: item.origin,
    name: item.variant || item.name,
  });
}
