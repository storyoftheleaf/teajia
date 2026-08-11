import { describe, expect, it } from 'vitest';

import type { InventoryItem, StarterSet } from '../../types';
import { resolvePublicSetItems } from './setContents';

const set = {
  id: 'set-1',
  name: 'Starter Set',
  shortDescription: '',
  description: '',
  price: '$40',
  tags: [],
  items: [
    { type: 'tea', itemId: 'known-tea' },
    { type: 'ware', itemId: 'private-inventory-id', quantity: 2 },
  ],
} satisfies StarterSet;

describe('resolvePublicSetItems', () => {
  it('uses catalogue names and neutral copy for unresolved items', () => {
    const inventory = [{ id: 'known-tea', name: 'Silver Needle' }] as InventoryItem[];

    expect(resolvePublicSetItems(set, inventory)).toEqual([
      {
        name: 'Silver Needle',
        type: 'tea',
        quantity: 50,
        unit: 'g',
      },
      {
        name: 'Unavailable item',
        type: 'ware',
        quantity: 2,
        unit: '',
      },
    ]);
    expect(JSON.stringify(resolvePublicSetItems(set, inventory))).not.toContain('private-inventory-id');
  });

  it('does not mutate the set or inventory', () => {
    const inventory = [{ id: 'known-tea', name: 'Silver Needle' }] as InventoryItem[];
    const originalSet = structuredClone(set);
    const originalInventory = structuredClone(inventory);

    resolvePublicSetItems(set, inventory);

    expect(set).toEqual(originalSet);
    expect(inventory).toEqual(originalInventory);
  });
});
