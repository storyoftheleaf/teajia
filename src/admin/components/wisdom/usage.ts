import { useEffect, useState } from 'react';
import { resolveTea } from '../../../wisdom';
import type { Product } from '../../types';
import { ALL_VARIETIES } from './holdings';
import type { WisdomUsageProduct } from './config';

/**
 * The blast radius of an edit, counted rather than described.
 *
 * Every holding already says where it is read: the import editor, the shop, a
 * public reference. That is the wiring, and it is the same sentence whether the
 * entry answers for eleven products or for none. What decides how carefully an
 * operator edits a record is the load actually on it, so this counts it: for
 * each holding, how many products in the account resolve through each entry
 * right now, and which products those are.
 *
 * It is counted with `resolveTea`, not with a private rule, because `resolveTea`
 * is what the import editor and the shop call. A count produced any other way
 * would be a second opinion, and the whole point of the number is that it is the
 * same answer those surfaces will give.
 *
 * That also makes it the most expensive thing this screen does: one `resolveTea`
 * per product, against every alias index the base holds. It is therefore neither
 * eager nor repeated. See `useWisdomUsage` at the foot of this file.
 */

export interface WisdomUsageEntry {
  count: number;
  /**
   * The products themselves, name-sorted. Held in full rather than capped:
   * an account has a few hundred products, the panel decides how many to show,
   * and a cap here would silently make "and 12 more" unreachable again.
   */
  products: WisdomUsageProduct[];
}

export interface WisdomUsage {
  /** How many products were scanned to build this. */
  total: number;
  /** holding id, then entry id, then what resolves through it. */
  byHolding: ReadonlyMap<string, ReadonlyMap<string, WisdomUsageEntry>>;
  /** Per holding, how many products resolve through any entry of it at all. */
  byHoldingTotal: ReadonlyMap<string, number>;
}

/**
 * There is deliberately no empty-usage constant. "Not counted yet" is
 * `undefined`, and every reader of it answers that by staying silent; a zeroed
 * object would let a panel say "no product resolves through this entry" before
 * anything had been counted, which is a confident wrong answer.
 */

/** Varieties have no id of their own in the base, so the flat list carries it. */
const varietyId = (type: string, name: string): string | null =>
  ALL_VARIETIES.find(row => row.type === type && row.name === name)?.id ?? null;

/** What to call a product in a chip: what the operator named it, then the botanical name. */
const productLabel = (product: Product): string =>
  product.givenName?.trim() || product.productName?.trim() || product.chineseName?.trim() || 'Untitled';

export function countWisdomUsage(products: readonly Product[]): WisdomUsage {
  const byHolding = new Map<string, Map<string, WisdomUsageEntry>>();
  const byHoldingTotal = new Map<string, number>();

  const note = (holding: string, entry: string | null | undefined, product: WisdomUsageProduct) => {
    if (!entry) return;
    const bucket = byHolding.get(holding) ?? new Map<string, WisdomUsageEntry>();
    const held = bucket.get(entry) ?? { count: 0, products: [] };
    held.count += 1;
    held.products.push(product);
    bucket.set(entry, held);
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
    const named: WisdomUsageProduct = { id: product.id, name: productLabel(product) };
    note('cultivars', resolution.cultivar?.id, named);
    note('regions', resolution.region?.id, named);
    note('producers', resolution.producer?.id, named);
    note('marks', resolution.mark?.id, named);
    note('styles', resolution.style?.id, named);
    note('named-teas', resolution.namedTea?.id, named);
    if (resolution.variety) note('varieties', varietyId(resolution.variety.type, resolution.variety.name), named);
  }

  // Sorted once here rather than on every panel open. A blast radius read in
  // record order reads as noise; read alphabetically it reads as a list.
  for (const bucket of byHolding.values()) {
    for (const entry of bucket.values()) entry.products.sort((left, right) => left.name.localeCompare(right.name));
  }

  return { total: products.length, byHolding, byHoldingTotal };
}

/* ─────────────────────────── paying for it once ───────────────────────────── */

/**
 * One answer per product list, kept for as long as that list is alive.
 *
 * Keyed on the array React Query hands out, which is stable for as long as the
 * account's products have not changed and is replaced the moment they do. That
 * makes it a per-account cache with correct invalidation and no key to get
 * wrong, and it means walking into Wisdom for the second time in a session
 * costs nothing at all. A weak map so a switched account's answer is collected
 * with the products it was computed from.
 */
const answered = new WeakMap<readonly Product[], WisdomUsage>();

export function wisdomUsageFor(products: readonly Product[]): WisdomUsage {
  const held = answered.get(products);
  if (held) return held;
  const built = countWisdomUsage(products);
  answered.set(products, built);
  return built;
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * The blast radius, computed off the critical path.
 *
 * It used to run over every product on mount, before a single row was painted
 * and whether or not a panel was ever opened. Two things fix that. A cached
 * answer is returned synchronously, so the second visit is free. An uncached
 * one is computed in idle time, so the list paints first and the counts arrive
 * a frame later, which is the right order: the reader came to read rows.
 *
 * `undefined` until it is known, which every reader of it already handles by
 * staying silent. A confident "no products" that later turns into eleven is
 * worse than saying nothing.
 */
export function useWisdomUsage(products: readonly Product[] | undefined): WisdomUsage | undefined {
  const [usage, setUsage] = useState<WisdomUsage | undefined>(() =>
    products && products.length > 0 ? answered.get(products) : undefined,
  );

  useEffect(() => {
    if (!products || products.length === 0) {
      setUsage(undefined);
      return;
    }
    const held = answered.get(products);
    if (held) {
      setUsage(held);
      return;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) setUsage(wisdomUsageFor(products));
    };

    const idle = typeof window !== 'undefined' ? (window as IdleWindow) : null;
    if (idle?.requestIdleCallback) {
      // The timeout is the floor: idle time that never comes must not mean a
      // panel that never says what it would move.
      const handle = idle.requestIdleCallback(run, { timeout: 500 });
      return () => {
        cancelled = true;
        idle.cancelIdleCallback?.(handle);
      };
    }

    const handle = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [products]);

  return usage;
}
