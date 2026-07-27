import { useEffect, useState } from 'react';
import { resolveTea } from '../../../wisdom';
import type { Product } from '../../types';
import { ALL_VARIETIES, findHolding } from './holdings';
import { wisdomEntryHref, type WisdomUsageProduct } from './config';

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
 * Three states, not two, and the third one used to be indistinguishable from the
 * first.
 *
 * `undefined` is "not counted yet", and every reader answers it by staying
 * silent, because a confident "no product resolves through this entry" said
 * before anything is counted is a wrong answer. This constant is the other
 * absence: the products WERE read and the account holds none. Both leave every
 * `total === 0` guard behaving exactly as it did; the difference is that a gap
 * counted from the base alone can now say whether it is still waiting or has
 * settled at a number that will not move until stock arrives.
 */
const COUNTED_NOTHING: WisdomUsage = {
  total: 0,
  byHolding: new Map(),
  byHoldingTotal: new Map(),
};

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

/* ────────────────── the same answer, read from the inventory ──────────────── */

/**
 * The inventory narrowed to one wisdom entry: which products, and what to call
 * the filter in the chip that clears it.
 *
 * This is the return leg of the blast radius. The panel could say WHICH sixty
 * products resolve through a cultivar, and then the only way to work on them was
 * to leave for the inventory and rebuild the question by hand. The inventory
 * takes the entry in its address instead, exactly as it already takes a vendor
 * and a batch, and the same `resolveTea` answer decides the set, so the two
 * screens can never disagree about it.
 */
export interface WisdomInventoryScope {
  ids: ReadonlySet<string>;
  /** The entry's own name, for the chip that offers to clear the filter. */
  label: string;
  /**
   * What KIND of thing the name is: Cultivar, Region, Mark.
   *
   * A vendor, a batch and a wisdom entry all reached the chip as one truncating
   * label, so a plant named the same as a supplier was indistinguishable from
   * it and the chip could not say which of the three it would clear. The kind is
   * the holding's own panel eyebrow, so the two screens use one word for it.
   */
  kind: string;
  /** The way back to the entry that filtered the list, and to the list itself. */
  href: string;
}

/**
 * `holding:entry[:shape[:query]]`, the form `wisdomInventoryHref` writes.
 *
 * The first two fields are the filter. The last two are the list the operator
 * was reading when they crossed, which this screen carries and never reads: the
 * chip's way back used to land on the entry and nothing else, so an operator
 * working through the seven marks with no held producer, grouped and sorted and
 * narrowed to a query, came back to all fifteen in the default order. The query
 * is last because it is the only field a person types, so it is the only one
 * that can hold a colon, and taking it as the remainder keeps it whole.
 */
export function readWisdomScope(
  param: string | null | undefined,
  products: readonly Product[] | undefined,
): WisdomInventoryScope | null {
  if (!param) return null;
  const [holdingId, entryId, shape = '', ...rest] = param.split(':');
  const query = rest.join(':');
  const holding = findHolding(holdingId);
  if (!holding || !entryId) return null;

  const row = holding.rows.find(entry => holding.idOf(entry) === entryId);
  const label = row ? String(holding.columns[0].value(row) ?? entryId) : entryId;
  // The holding's own word for what this is, so the chip says "Cultivar" where
  // the panel says "Cultivar". A hand-edited address naming an entry the base
  // does not hold falls back to the holding's label rather than to nothing.
  const kind = row ? holding.detail(row).kind : holding.label;
  // The way back to the entry AND to the list it was read in. The shape is not
  // checked here; it is checked on arrival, against the holding, by the screen
  // that has to honour it.
  const href = wisdomEntryHref(holding.id, entryId, { shape, query });
  // An empty set while the products are still loading, so the grid shows nothing
  // rather than everything. The batch filter above it behaves the same way.
  if (!products || products.length === 0) return { ids: new Set<string>(), label, kind, href };

  const bucket = wisdomUsageFor(products).byHolding.get(holding.id)?.get(entryId);
  return { ids: new Set((bucket?.products ?? []).map(product => product.id)), label, kind, href };
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
 *
 * An account that HOLDS no products is a different answer from an account whose
 * products have not been read, and it used to be the same one: both were
 * `undefined`, so a gap counted from the base alone sat under "until the
 * products in this account are read" waiting on a reading that had already
 * happened and had nothing to say. An empty list now counts to zero.
 */
export function useWisdomUsage(products: readonly Product[] | undefined): WisdomUsage | undefined {
  const [usage, setUsage] = useState<WisdomUsage | undefined>(() => {
    if (!products) return undefined;
    return products.length === 0 ? COUNTED_NOTHING : answered.get(products);
  });

  useEffect(() => {
    if (!products) {
      setUsage(undefined);
      return;
    }
    if (products.length === 0) {
      setUsage(COUNTED_NOTHING);
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
