import type { InventoryPurpose, Product } from '../../types';

export type TeaReadinessMissing =
  | 'description'
  | 'retail_price'
  | 'classification'
  | 'stock_amount';

export type TeaReadiness = {
  state: 'ready' | 'not_ready' | 'not_applicable';
  missing: TeaReadinessMissing[];
};

type PurposeFields = Pick<Product, 'inventoryPurpose' | 'isSample' | 'isPersonal'>;

/** Canonical purpose wins; legacy flags provide deterministic compatibility. */
export function effectivePurpose(product: PurposeFields): InventoryPurpose {
  if (product.inventoryPurpose) return product.inventoryPurpose;
  if (product.isSample) return 'sample';
  if (product.isPersonal) return 'personal';
  return 'working';
}

/** Identifies legacy ambiguity or a failed dual-write without changing the effective value. */
export function legacyPurposeConflict(product: PurposeFields): boolean {
  if (product.isSample && product.isPersonal) return true;
  if (!product.inventoryPurpose) return false;

  const legacyPurpose: InventoryPurpose = product.isSample
    ? 'sample'
    : product.isPersonal
      ? 'personal'
      : 'working';
  return legacyPurpose !== product.inventoryPurpose;
}

function hasPositiveRetail(product: Pick<Product, 'fixedRetailPriceUSD' | 'pricePerGramUSD'>): boolean {
  const effectiveRetail = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
  return Number.isFinite(effectiveRetail) && effectiveRetail > 0;
}

export function getTeaReadiness(product: Product): TeaReadiness {
  if (product.type === 'Teaware' || effectivePurpose(product) !== 'working') {
    return { state: 'not_applicable', missing: [] };
  }

  const missing: TeaReadinessMissing[] = [];
  if (!product.description.trim()) missing.push('description');
  if (!hasPositiveRetail(product)) missing.push('retail_price');
  if (product.type === 'Misc' || product.type === 'MISSING_TYPE') missing.push('classification');
  if (!product.stockKnownAt || !Number.isFinite(product.stockGrams)) missing.push('stock_amount');

  return missing.length > 0
    ? { state: 'not_ready', missing }
    : { state: 'ready', missing };
}

export type EffectivePublication = {
  state: 'published' | 'hidden';
  operatorGate: boolean;
  locationGate: boolean;
};

export function getEffectivePublication(
  product: Pick<Product, 'isPublic' | 'shownInShop'>,
): EffectivePublication {
  return {
    state: product.isPublic && product.shownInShop ? 'published' : 'hidden',
    operatorGate: product.isPublic,
    locationGate: product.shownInShop,
  };
}

export type InventoryStage =
  | 'published'
  | 'ready_private'
  | 'incoming'
  | 'needs_preparation'
  | 'archived';

export const INVENTORY_STAGE_ORDER: readonly InventoryStage[] = [
  'published',
  'ready_private',
  'incoming',
  'needs_preparation',
  'archived',
];

export const INVENTORY_STAGE_LABELS: Record<InventoryStage, string> = {
  published: 'Published',
  ready_private: 'Ready, private',
  incoming: 'Incoming',
  needs_preparation: 'Needs preparation',
  archived: 'Archived',
};

export type IncomingInventorySummary = {
  hasOpenIncoming: boolean;
  remainingQuantity: number;
};

export type PersonalTastingSummary = {
  count: number;
  latestEntryId?: string | null;
};

export function getPersonalTastingAction(summary: PersonalTastingSummary): 'Record tasting' | 'Continue tasting' {
  return summary.count > 0 ? 'Continue tasting' : 'Record tasting';
}

export function buildPersonalJournalHref(productId: string, summary: PersonalTastingSummary): string {
  const base = `/account/journal?tea=${encodeURIComponent(productId)}`;
  return summary.latestEntryId ? `${base}&entry=${encodeURIComponent(summary.latestEntryId)}` : base;
}

export type InventorySummaryStatus = 'loading' | 'ready' | 'stale' | 'error';

export function inventorySummaryStatusMessage(status: InventorySummaryStatus): string | null {
  if (status === 'loading') return 'Refreshing tasting, writing, and incoming status…';
  if (status === 'stale') return 'Showing the last available tasting and writing status. Refresh to try again.';
  if (status === 'error') return 'Tasting and writing status is unavailable. Inventory values are still shown.';
  return null;
}

export function shouldApplyInventoryFacetFilter(filter: InventoryFacetFilter, status: InventorySummaryStatus): boolean {
  if (status === 'ready' || status === 'stale') return true;
  return !['Tasted', 'Untasted', 'HasWriting', 'NeedsWriting', 'HasProductTasting', 'NeedsProductTasting'].includes(filter);
}

export type InventoryWritingSummary = {
  description: boolean;
  draftArticleCount: number;
  publishedArticleCount: number;
};

export type InventoryWritingState =
  | 'none'
  | 'description'
  | 'draft_article'
  | 'published_article';

export type InventorySummaryRow = {
  product_id: string;
  incoming_quantity: number;
  has_open_incoming: boolean;
  writing_count: number;
  published_writing_count: number;
  has_writing: boolean;
  personal_tasting_count: number;
  personally_tasted: boolean;
  latest_tasting_entry_id?: string | null;
};

export type InventorySummaryAdapter = {
  incomingByProductId: Record<string, IncomingInventorySummary>;
  personalTastingByProductId: Record<string, PersonalTastingSummary>;
  writingByProductId: Record<string, InventoryWritingSummary>;
};

export function adaptInventorySummaryRows(
  rows: InventorySummaryRow[],
  products: Product[],
): InventorySummaryAdapter {
  const productsById = new Map(products.map(product => [product.id, product]));
  const adapted: InventorySummaryAdapter = {
    incomingByProductId: {},
    personalTastingByProductId: {},
    writingByProductId: {},
  };

  for (const row of rows) {
    const linkedWritingCount = Math.max(0, Number(row.writing_count) || 0);
    const publishedWritingCount = Math.min(
      linkedWritingCount,
      Math.max(0, Number(row.published_writing_count) || 0),
    );
    const product = productsById.get(row.product_id);
    adapted.incomingByProductId[row.product_id] = {
      hasOpenIncoming: row.has_open_incoming === true,
      remainingQuantity: Math.max(0, Number(row.incoming_quantity) || 0),
    };
    adapted.personalTastingByProductId[row.product_id] = {
      count: Math.max(0, Number(row.personal_tasting_count) || (row.personally_tasted ? 1 : 0)),
      ...(row.latest_tasting_entry_id ? { latestEntryId: row.latest_tasting_entry_id } : {}),
    };
    adapted.writingByProductId[row.product_id] = {
      description: !!product?.description.trim() || (row.has_writing && linkedWritingCount === 0),
      draftArticleCount: linkedWritingCount - publishedWritingCount,
      publishedArticleCount: publishedWritingCount,
    };
  }

  return adapted;
}

export type InventoryFacets = {
  personallyTasted: boolean;
  personalTastingCount: number;
  personalTastingEntryId: string | null;
  productTastingProfilePresent: boolean;
  productDescriptionPresent: boolean;
  writingState: InventoryWritingState;
  incomingReplenishment: boolean;
  lowStock: boolean;
  soldOut: boolean;
  missingReadinessInformation: TeaReadinessMissing[];
  effectivePublication: EffectivePublication;
};

function legacyIncomingSummary(product: Product): IncomingInventorySummary {
  const remainingQuantity = Number(product.inTransitGrams) || 0;
  return {
    hasOpenIncoming: product.inTransit === true && (remainingQuantity > 0 || product.inTransitGrams == null),
    remainingQuantity: remainingQuantity > 0 ? remainingQuantity : product.inTransit ? 1 : 0,
  };
}

function onHandQuantity(product: Product): number {
  return product.type === 'Teaware'
    ? Number(product.quantityUnits) || 0
    : Number(product.stockGrams) || 0;
}

/**
 * Places a record into one exclusive operational stage. Incoming summaries are
 * supplied by the batched inventory endpoint when available. Legacy fields keep
 * the classification useful while that endpoint is rolling out.
 */
export function deriveInventoryStage(
  product: Product,
  incomingSummary: IncomingInventorySummary = legacyIncomingSummary(product),
): InventoryStage {
  if (product.status === 'Archived' || product.status === 'Sold Out') return 'archived';
  if (getEffectivePublication(product).state === 'published') return 'published';
  if (onHandQuantity(product) <= 0 && incomingSummary.hasOpenIncoming && incomingSummary.remainingQuantity > 0) {
    return 'incoming';
  }
  if (getTeaReadiness(product).state !== 'not_ready') return 'ready_private';
  return 'needs_preparation';
}

export function isInventorySelectionPublishable(
  products: readonly Product[],
  incomingByProductId: Readonly<Record<string, IncomingInventorySummary>>,
  summaryStatus: InventorySummaryStatus,
): boolean {
  if (summaryStatus !== 'ready' || products.length === 0) return false;
  return products.every(product => deriveInventoryStage(product, incomingByProductId[product.id]) !== 'incoming');
}

/**
 * Publication gates may always be switched off. Switching either gate on must
 * pass the same arrival-state check, regardless of which inventory surface
 * initiated the update.
 */
export function isInventoryPublicationGateChangeAllowed(
  product: Product,
  field: keyof Product,
  nextValue: unknown,
  incomingByProductId: Readonly<Record<string, IncomingInventorySummary>>,
  summaryStatus: InventorySummaryStatus,
): boolean {
  const turnsPublicationGateOn = (field === 'isPublic' || field === 'shownInShop') && nextValue === true;
  return !turnsPublicationGateOn || isInventorySelectionPublishable(
    [product],
    incomingByProductId,
    summaryStatus,
  );
}

export function deriveInventoryFacets(
  product: Product,
  personalTasting: PersonalTastingSummary = { count: 0 },
  writing: InventoryWritingSummary = {
    description: product.description.trim().length > 0,
    draftArticleCount: 0,
    publishedArticleCount: 0,
  },
  incomingSummary: IncomingInventorySummary = legacyIncomingSummary(product),
): InventoryFacets {
  const writingState: InventoryWritingState = writing.publishedArticleCount > 0
    ? 'published_article'
    : writing.draftArticleCount > 0
      ? 'draft_article'
      : writing.description
        ? 'description'
        : 'none';
  const quantity = onHandQuantity(product);
  const readiness = getTeaReadiness(product);
  const hasProductTasting = product.tastingSource === 'owner'
    && !!(product.tasting && Object.keys(product.tasting).length > 0);

  return {
    personallyTasted: personalTasting.count > 0,
    personalTastingCount: Math.max(0, personalTasting.count),
    personalTastingEntryId: personalTasting.latestEntryId ?? null,
    productTastingProfilePresent: hasProductTasting,
    productDescriptionPresent: writing.description,
    writingState,
    incomingReplenishment: quantity > 0 && incomingSummary.hasOpenIncoming && incomingSummary.remainingQuantity > 0,
    lowStock: quantity <= product.lowStockThreshold,
    soldOut: product.status === 'Sold Out',
    missingReadinessInformation: readiness.missing,
    effectivePublication: getEffectivePublication(product),
  };
}

export type InventoryFacetFilter =
  | 'Tasted'
  | 'Untasted'
  | 'HasWriting'
  | 'NeedsWriting'
  | 'HasProductTasting'
  | 'NeedsProductTasting';

export function inventoryMatchesFacetFilter(
  product: Product,
  filter: InventoryFacetFilter,
  personalTasting: PersonalTastingSummary,
  writing: InventoryWritingSummary,
): boolean {
  const facets = deriveInventoryFacets(product, personalTasting, writing);
  switch (filter) {
    case 'Tasted': return facets.personallyTasted;
    case 'Untasted': return !facets.personallyTasted;
    case 'HasWriting': return facets.writingState !== 'none';
    case 'NeedsWriting': return facets.writingState === 'none';
    case 'HasProductTasting': return facets.productTastingProfilePresent;
    case 'NeedsProductTasting': return !facets.productTastingProfilePresent;
  }
}

export type InventoryLifecycleGroup = {
  stage: InventoryStage;
  label: string;
  items: Product[];
  totalStock: number;
  totalRetail: number;
};

export function groupInventoryByLifecycle(
  products: Product[],
  incomingByProductId: Readonly<Record<string, IncomingInventorySummary>> = {},
): InventoryLifecycleGroup[] {
  const groups = new Map(INVENTORY_STAGE_ORDER.map(stage => [stage, [] as Product[]]));
  for (const product of products) {
    groups.get(deriveInventoryStage(product, incomingByProductId[product.id]))?.push(product);
  }

  return INVENTORY_STAGE_ORDER.map(stage => {
    const items = groups.get(stage) ?? [];
    return {
      stage,
      label: INVENTORY_STAGE_LABELS[stage],
      items,
      totalStock: Math.round(items.reduce((sum, product) => sum + onHandQuantity(product), 0)),
      totalRetail: items.reduce((sum, product) => {
        const retail = Number(product.fixedRetailPriceUSD ?? product.pricePerGramUSD) || 0;
        return sum + retail * onHandQuantity(product);
      }, 0),
    };
  });
}

export type MovementReason =
  | 'receipt'
  | 'sale'
  | 'sample_use'
  | 'gift'
  | 'waste'
  | 'transfer'
  | 'recount'
  | 'return';

export type MovementDirection = 'increase' | 'decrease' | 'set';

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  receipt: 'Receipt',
  sale: 'Sale',
  sample_use: 'Sample use',
  gift: 'Gift',
  waste: 'Waste',
  transfer: 'Transfer',
  recount: 'Recount / correction',
  return: 'Return',
};

const MOVEMENT_DIRECTIONS: Record<MovementReason, readonly MovementDirection[]> = {
  receipt: ['increase'],
  sale: ['decrease'],
  sample_use: ['decrease'],
  gift: ['decrease'],
  waste: ['decrease'],
  transfer: ['increase', 'decrease'],
  recount: ['set'],
  return: ['increase'],
};

export function isMovementDirectionValid(
  reason: MovementReason,
  direction: MovementDirection,
): boolean {
  return MOVEMENT_DIRECTIONS[reason].includes(direction);
}
