import { useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { Product } from '../../types';
import {
  DEFAULT_TEA_VIEWS,
  DEFAULT_TEAWARE_VIEWS,
  TEA_COLUMN_DEFS,
  TEAWARE_COLUMN_DEFS,
} from './config';
import { effectivePurpose, getTeaReadiness, groupInventoryByLifecycle, inventoryMatchesFacetFilter, shouldApplyInventoryFacetFilter } from './domain';
import type { IncomingInventorySummary, InventoryFacetFilter, InventorySummaryStatus, InventoryWritingSummary, PersonalTastingSummary } from './domain';
import type { InventoryCategory, InventoryProductGroup, InventorySortDirection } from './types';

type UseInventoryProductsArgs = {
  localProducts: Product[];
  inventoryCategory: InventoryCategory;
  searchQuery: string;
  filterType: string;
  inventorySortConfig: { key: string; direction: InventorySortDirection }[];
  inventoryColumns: string[];
  inventoryGroupBy: string | null;
  priceMode: 'retail' | 'cost';
  /**
   * While edit mode is active, the visible row ORDER is frozen so an inline
   * rename (or any value edit that would change the sort) doesn't make the row
   * jump under the cursor, which previously read as "a new product appeared."
   * Filtering/search still run live; only the final sort step is pinned to the
   * order captured when edit mode turned on.
   */
  isEditMode: boolean;
  /** Batched or locally adapted personal journal state, keyed by product id. */
  personalTastingByProductId?: Readonly<Record<string, PersonalTastingSummary>>;
  /** Batched writing state. Description-only fallback is derived locally. */
  writingSummaryByProductId?: Readonly<Record<string, InventoryWritingSummary>>;
  /** Normalized receipt summary. Legacy product fields remain a fallback. */
  incomingByProductId?: Readonly<Record<string, IncomingInventorySummary>>;
  summaryStatus?: InventorySummaryStatus;
};

export function useInventoryProducts({
  localProducts,
  inventoryCategory,
  searchQuery,
  filterType,
  inventorySortConfig,
  inventoryColumns,
  inventoryGroupBy,
  priceMode,
  isEditMode,
  personalTastingByProductId = {},
  writingSummaryByProductId = {},
  incomingByProductId = {},
  summaryStatus = 'ready',
}: UseInventoryProductsArgs) {
  // Frozen row order for edit mode. Captured (id → position) the first render
  // after edit mode turns on, cleared the moment it turns off. Items missing
  // from the snapshot (e.g. a product that just started matching the filter)
  // sort to the end, preserving their live relative order.
  const frozenOrderRef = useRef<Map<string, number> | null>(null);
  if (!isEditMode && frozenOrderRef.current) {
    frozenOrderRef.current = null;
  }
  // Fuse in a ref so it doesn't appear in processedProducts deps. Rebuilding only
  // when local products change prevents edit keystrokes from double-recomputing.
  const fuseRef = useRef<Fuse<Product>>(new Fuse(localProducts, {
    keys: ['givenName', 'productName', 'chineseName', 'originRegion', 'vendor'],
    threshold: 0.3,
    ignoreLocation: true,
  }));

  useEffect(() => {
    fuseRef.current = new Fuse(localProducts, {
      keys: ['givenName', 'productName', 'chineseName', 'originRegion', 'vendor'],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [localProducts]);

  const activeColumnDefs = useMemo(
    () => inventoryCategory === 'teaware' ? TEAWARE_COLUMN_DEFS : TEA_COLUMN_DEFS,
    [inventoryCategory]
  );

  const activeDefaultViews = useMemo(
    () => inventoryCategory === 'teaware' ? DEFAULT_TEAWARE_VIEWS : DEFAULT_TEA_VIEWS,
    [inventoryCategory]
  );

  const processedProducts = useMemo(() => {
    let result = localProducts;

    if (inventoryCategory === 'teaware') {
      result = result.filter(p => p.type === 'Teaware');
    } else {
      result = result.filter(p => p.type !== 'Teaware');
    }

    if (filterType !== 'Archived' && filterType !== 'All') {
      result = result.filter(p => p.status !== 'Archived');
    }

    if (searchQuery) {
      result = fuseRef.current.search(searchQuery).map(r => r.item).filter(p =>
        inventoryCategory === 'teaware' ? p.type === 'Teaware' : p.type !== 'Teaware'
      );
    }

    if (filterType === 'Alerts') {
      result = result.filter(p => p.status === 'Draft' || p.stockGrams <= p.lowStockThreshold || p.pricePerGramUSD === 0 || p.recheckStock);
    } else if (filterType === 'NeedsDevelopment') {
      result = result.filter(p => getTeaReadiness(p).state === 'not_ready');
    } else if (filterType === 'ToTaste') {
      result = result.filter(p => inventoryMatchesFacetFilter(
        p,
        'Untasted',
        personalTastingByProductId[p.id] ?? { count: 0 },
        writingSummaryByProductId[p.id] ?? { description: !!p.description.trim(), draftArticleCount: 0, publishedArticleCount: 0 },
      ));
    } else if (filterType === 'Reorder') {
      result = result.filter(p => p.canReorder && (p.type === 'Teaware' ? (p.quantityUnits ?? 0) : p.stockGrams) <= p.lowStockThreshold);
    } else if (filterType === 'LowStock') {
      result = result.filter(p => (p.type === 'Teaware' ? (p.quantityUnits ?? 0) : p.stockGrams) <= p.lowStockThreshold);
    } else if (filterType === 'MissingLocation') {
      result = result.filter(p => !p.inventoryLocation?.trim());
    } else if (filterType === 'Drafts') {
      result = result.filter(p => p.status === 'Draft');
    } else if (filterType === 'Pending') {
      result = result.filter(p => p.lore && !p.showWisdom);
    } else if (filterType === 'Unverified') {
      result = result.filter(p => !p.stockVerifiedAt);
    } else if (filterType === 'Unpublished') {
      result = result.filter(p => !p.isPublic);
    } else if (filterType === 'Samples') {
      result = result.filter(p => effectivePurpose(p) === 'sample');
    } else if (filterType === 'Personal') {
      result = result.filter(p => effectivePurpose(p) === 'personal');
    } else if (filterType === 'Working' || filterType === 'ForSale') {
      result = result.filter(p => effectivePurpose(p) === 'working');
    } else if (['Tasted', 'Untasted', 'HasWriting', 'NeedsWriting', 'HasProductTasting', 'NeedsProductTasting'].includes(filterType)) {
      const facetFilter = filterType as InventoryFacetFilter;
      if (shouldApplyInventoryFacetFilter(facetFilter, summaryStatus)) {
        result = result.filter(p => inventoryMatchesFacetFilter(
          p,
          facetFilter,
          personalTastingByProductId[p.id] ?? { count: 0 },
          writingSummaryByProductId[p.id] ?? { description: !!p.description.trim(), draftArticleCount: 0, publishedArticleCount: 0 },
        ));
      }
    } else if (filterType === 'Archived') {
      result = result.filter(p => p.status === 'Archived');
    } else if (filterType === 'SoldOut') {
      result = result.filter(p => p.status === 'Sold Out');
    } else if (filterType !== 'All') {
      result = result.filter(p => p.type === filterType);
    }

    const sorted = [...result].sort((a, b) => {
      for (const sort of inventorySortConfig) {
        const key = sort.key as keyof Product;
        if (key === 'type') {
          if (a.type === 'Teaware' && b.type !== 'Teaware') return 1;
          if (a.type !== 'Teaware' && b.type === 'Teaware') return -1;
        }
        const aVal = a[key];
        const bVal = b[key];
        if (aVal === bVal) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comparison = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        const dir = sort.direction === 'asc' ? comparison : -comparison;
        if (dir !== 0) return dir;
      }
      return 0;
    });

    // Edit mode freeze: pin the visible order so an inline rename / value edit
    // doesn't re-sort the row out from under the cursor. Capture the snapshot on
    // the first edit-mode render, then sort every subsequent render by it.
    if (isEditMode) {
      if (!frozenOrderRef.current) {
        frozenOrderRef.current = new Map(sorted.map((p, i) => [p.id, i]));
        return sorted;
      }
      const frozen = frozenOrderRef.current;
      const END = Number.MAX_SAFE_INTEGER;
      return [...sorted].sort(
        (a, b) => (frozen.get(a.id) ?? END) - (frozen.get(b.id) ?? END)
      );
    }

    return sorted;
  }, [localProducts, searchQuery, filterType, inventorySortConfig, inventoryCategory, isEditMode, personalTastingByProductId, writingSummaryByProductId, summaryStatus]);

  const visibleCols = useMemo(() => activeColumnDefs.filter(col => {
    const isCostCol = col.key === 'costAmount' || col.key === 'costPerGramUSD';
    const isRetailCol = col.key === 'pricePerGramUSD';
    if (isCostCol) return priceMode === 'cost';
    if (isRetailCol) return priceMode === 'retail';
    return inventoryColumns.includes(col.key);
  }), [inventoryColumns, activeColumnDefs, priceMode]);

  const productIndexMap = useMemo(
    () => new Map(processedProducts.map((p, i) => [p.id, i])),
    [processedProducts]
  );

  const groupedProducts = useMemo(() => {
    if (!inventoryGroupBy) {
      return groupInventoryByLifecycle(processedProducts, incomingByProductId)
        .map<InventoryProductGroup>(group => ({
          key: group.stage,
          label: group.label,
          items: group.items,
          totalStock: group.totalStock,
          totalRetail: group.totalRetail,
          lifecycle: true,
        }));
    }
    const groups: Record<string, InventoryProductGroup> = {};
    for (const p of processedProducts) {
      // Stock spine step 2: a null owner means the row is owned by the location
      // itself (house stock), not an individual seller, label it as such rather
      // than the generic "Unknown" bucket.
      const key = inventoryGroupBy === 'ownerUserId'
        ? (p.ownerUserId ? `Seller · ${p.ownerUserId.slice(0, 8)}` : 'House stock')
        : String((p as unknown as Record<string, unknown>)[inventoryGroupBy] ?? 'Unknown');
      if (!groups[key]) groups[key] = { key, label: key, items: [], totalStock: 0, totalRetail: 0, lifecycle: false };
      groups[key].items.push(p);
      groups[key].totalStock += Number(p.stockGrams) || 0;
      groups[key].totalRetail += (Number(p.fixedRetailPriceUSD ?? p.pricePerGramUSD) || 0) * (Number(p.stockGrams) || 0);
    }
    for (const g of Object.values(groups)) g.totalStock = Math.round(g.totalStock);
    return Object.values(groups);
  }, [processedProducts, inventoryGroupBy, incomingByProductId]);

  const pendingCount = useMemo(
    () => localProducts.filter(p => p.lore && !p.showWisdom).length,
    [localProducts]
  );

  const verificationStats = useMemo(() => {
    const categoryProducts = inventoryCategory === 'teaware'
      ? localProducts.filter(p => p.type === 'Teaware')
      : localProducts.filter(p => p.type !== 'Teaware');
    const countable = categoryProducts.filter(p => p.status !== 'Archived');
    const verified = countable.filter(p => !!p.stockVerifiedAt).length;
    return { total: countable.length, verified, remaining: countable.length - verified };
  }, [localProducts, inventoryCategory]);

  return {
    activeColumnDefs,
    activeDefaultViews,
    processedProducts,
    visibleCols,
    productIndexMap,
    groupedProducts,
    pendingCount,
    verificationStats,
  };
}
