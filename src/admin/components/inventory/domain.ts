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
