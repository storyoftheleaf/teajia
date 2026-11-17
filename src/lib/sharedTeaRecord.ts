import type { TeaCompassEntry } from '../components/TeaCompass/types';

/** Only durable links identify a shared record. A matching name or source does
 * not mean two teas are the same, and opening Inventory never makes a copy. */
export function sharedTeaRecordId(product: { id: string; sourceCompassEntryId?: string }, entries: Pick<TeaCompassEntry, 'id' | 'draftProductId'>[]): string | undefined {
  return product.sourceCompassEntryId || entries.find(entry => entry.draftProductId === product.id)?.id;
}

export function sharedTeaRecordHref(entryId: string): string {
  return `/admin/compass?tab=library&entry=${encodeURIComponent(entryId)}`;
}

/** Resolve only a verified product in this account, never a name match or stale ID. */
type LinkedStockProduct = {
  id: string;
  source_compass_entry_id?: string | null;
  sourceCompassEntryId?: string | null;
  inventory_purpose?: string | null;
  inventoryPurpose?: string | null;
  is_sample?: boolean | number | null;
  isSample?: boolean | number | null;
};

export function sharedStockRecordId(
  entry: Pick<TeaCompassEntry, 'id' | 'draftProductId'>,
  products: readonly LinkedStockProduct[],
): string | undefined {
  const source = (product: LinkedStockProduct) => product.source_compass_entry_id ?? product.sourceCompassEntryId;
  const isSample = (product: LinkedStockProduct) => {
    const purpose = product.inventory_purpose ?? product.inventoryPurpose;
    return purpose != null ? purpose === 'sample' : !!(product.is_sample ?? product.isSample);
  };
  const linked = products.filter(product => source(product) === entry.id);
  return linked.find(product => !isSample(product))?.id
    ?? linked[0]?.id
    ?? products.find(product => product.id === entry.draftProductId && !source(product))?.id;
}
export function sharedStockRecordHref(productId: string): string {
  return `/admin/stock?panel=${encodeURIComponent(productId)}`;
}
