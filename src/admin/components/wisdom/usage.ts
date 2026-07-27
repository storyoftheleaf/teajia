import { resolveTea } from '../../../wisdom';
import type { Product } from '../../types';
import { ALL_VARIETIES } from './holdings';

/**
 * The blast radius of an edit, counted rather than described.
 *
 * Every holding already says where it is read: the import editor, the shop, a
 * public reference. That is the wiring, and it is the same sentence whether the
 * entry answers for eleven products or for none. What decides how carefully an
 * operator edits a record is the load actually on it, so this counts it: for
 * each holding, how many products in the account resolve through each entry
 * right now.
 *
 * It is counted with `resolveTea`, not with a private rule, because `resolveTea`
 * is what the import editor and the shop call. A count produced any other way
 * would be a second opinion, and the whole point of the number is that it is the
 * same answer those surfaces will give.
 */

export interface WisdomUsage {
  /** How many products were scanned to build this. */
  total: number;
  /** holding id, then entry id, then the count of products resolving through it. */
  byHolding: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Per holding, how many products resolve through any entry of it at all. */
  byHoldingTotal: ReadonlyMap<string, number>;
}

export const EMPTY_USAGE: WisdomUsage = {
  total: 0,
  byHolding: new Map(),
  byHoldingTotal: new Map(),
};

/** Varieties have no id of their own in the base, so the flat list carries it. */
const varietyId = (type: string, name: string): string | null =>
  ALL_VARIETIES.find(row => row.type === type && row.name === name)?.id ?? null;

export function countWisdomUsage(products: readonly Product[]): WisdomUsage {
  const byHolding = new Map<string, Map<string, number>>();
  const byHoldingTotal = new Map<string, number>();

  const note = (holding: string, entry: string | null | undefined) => {
    if (!entry) return;
    const bucket = byHolding.get(holding) ?? new Map<string, number>();
    bucket.set(entry, (bucket.get(entry) ?? 0) + 1);
    byHolding.set(holding, bucket);
    byHoldingTotal.set(holding, (byHoldingTotal.get(holding) ?? 0) + 1);
  };

  for (const product of products) {
    const resolution = resolveTea({
      names: [product.productName, product.givenName, product.chineseName],
      known: {
        type: product.type,
        form: product.form,
        region: product.originRegion,
        country: product.originCountry,
        year: product.year,
      },
    });
    note('cultivars', resolution.cultivar?.id);
    note('regions', resolution.region?.id);
    note('producers', resolution.producer?.id);
    note('marks', resolution.mark?.id);
    note('styles', resolution.style?.id);
    note('named-teas', resolution.namedTea?.id);
    if (resolution.variety) note('varieties', varietyId(resolution.variety.type, resolution.variety.name));
  }

  return { total: products.length, byHolding, byHoldingTotal };
}
