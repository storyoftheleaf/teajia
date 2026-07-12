import type { InventoryPurposeValue } from '../../types';

type EntryLink = { id: string; draftProductId?: string | null; status?: unknown; sampleState?: unknown; isSample?: unknown };
type ProductLink = {
  id: string;
  source_compass_entry_id?: string | null;
  sourceCompassEntryId?: string | null;
  inventory_purpose?: string | null;
  inventoryPurpose?: string | null;
  is_sample?: number | boolean | null;
  isSample?: boolean | null;
  is_personal?: number | boolean | null;
  isPersonal?: boolean | null;
};

function productPurpose(product: ProductLink): InventoryPurposeValue {
  const explicit = product.inventory_purpose ?? product.inventoryPurpose;
  if (explicit === 'working' || explicit === 'sample' || explicit === 'personal') return explicit;
  if (product.is_sample || product.isSample) return 'sample';
  if (product.is_personal || product.isPersonal) return 'personal';
  return 'working';
}

export function buildEntryPossessionMap(entries: EntryLink[], products: ProductLink[]): Map<string, InventoryPurposeValue> {
  const productById = new Map(products.map((product) => [product.id, product]));
  const result = new Map<string, InventoryPurposeValue>();
  for (const product of products) {
    const sourceId = product.source_compass_entry_id ?? product.sourceCompassEntryId;
    if (sourceId) result.set(sourceId, productPurpose(product));
  }
  for (const entry of entries) {
    if (result.has(entry.id) || !entry.draftProductId) continue;
    const product = productById.get(entry.draftProductId);
    if (product) result.set(entry.id, productPurpose(product));
  }
  return result;
}
