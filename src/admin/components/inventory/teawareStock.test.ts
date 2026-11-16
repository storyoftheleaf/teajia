import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import type { PublicProduct } from '../../../types';
import { publicProductToInventoryItem } from '../../../lib/adapters';
import { isOutOfStock } from './domain';

describe('teaware stock is read in units', () => {
  it('a teapot with units on the shelf is not out of stock', () => {
    expect(isOutOfStock({ type: 'Teaware', stockGrams: 0, quantityUnits: 4 } as Product)).toBe(false);
    expect(isOutOfStock({ type: 'Teaware', stockGrams: 0, quantityUnits: 0 } as Product)).toBe(true);
  });
  it('tea still reads grams', () => {
    expect(isOutOfStock({ type: 'Oolong', stockGrams: 0, quantityUnits: 4 } as unknown as Product)).toBe(true);
    expect(isOutOfStock({ type: 'Oolong', stockGrams: 50 } as unknown as Product)).toBe(false);
  });
  it('the shop adapter carries teaware units, and tea grams', () => {
    const ware = publicProductToInventoryItem({ id: 'w', type: 'Teaware', stockGrams: 0, quantityUnits: 3 } as PublicProduct);
    expect(ware.stock_g).toBe(3);
    const tea = publicProductToInventoryItem({ id: 't', type: 'Oolong', stockGrams: 120, quantityUnits: 3 } as unknown as PublicProduct);
    expect(tea.stock_g).toBe(120);
  });
});
