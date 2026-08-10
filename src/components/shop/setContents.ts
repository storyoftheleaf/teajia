import type { InventoryItem, StarterSet } from '../../types';

export interface PublicSetItem {
  name: string;
  type: StarterSet['items'][number]['type'];
  quantity: number;
  unit: 'g' | '';
}

/** Resolve only display-safe set contents; inventory IDs never leave this helper. */
export function resolvePublicSetItems(
  set: StarterSet,
  inventory: InventoryItem[],
): PublicSetItem[] {
  const namesById = new Map(
    inventory.map(item => [item.id, item.name?.trim()]).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return set.items.map(({ type, itemId, quantity }) => ({
    name: namesById.get(itemId) ?? 'Unavailable item',
    type,
    quantity: quantity || (type === 'tea' ? 50 : 1),
    unit: type === 'tea' ? 'g' : '',
  }));
}
