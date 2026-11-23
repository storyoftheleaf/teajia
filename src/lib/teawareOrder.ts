import type { CartItem, InventoryItem } from '../types';

/** Teaware stock and the legacy price_50g field are both measured in pieces. */
export function teawareUnitPrice(item: Pick<InventoryItem, 'pricePerUnit' | 'price_50g'>) {
  const value = Number.parseFloat(item.pricePerUnit ?? item.price_50g ?? '');
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function teawareOrderSizes(units: number) {
  return [1, 2, 3, 4].filter(quantity => quantity <= units);
}

export function teawareRemaining(item: Pick<InventoryItem, 'id' | 'stock_g'>, cart: ReadonlyArray<Pick<CartItem, 'id' | 'quantityGrams'>>) {
  const ordered = cart.filter(line => line.id === item.id).reduce((sum, line) => sum + line.quantityGrams, 0);
  return Math.max(0, Math.floor(item.stock_g || 0) - ordered);
}
