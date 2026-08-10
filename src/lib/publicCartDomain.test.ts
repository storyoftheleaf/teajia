import { describe, expect, it } from 'vitest';
import {
  canAddToStoreCart,
  resolveCheckoutStoreSlug,
  validateStoreCart,
} from './publicCartDomain';

const bali = {
  id: 'tea-1',
  name: 'Tea',
  variant: '',
  category: 'tea' as const,
  quantityGrams: 25,
  pricePerGram: 1,
  totalPrice: 25,
  storeSlug: 'teajia-bali',
  storeName: 'Teajia Bali',
};
const australia = {
  ...bali,
  id: 'tea-2',
  storeSlug: 'teajia-australia',
  storeName: 'Teajia Australia',
};

describe('public cart store boundary', () => {
  it('resolves hosted, path, selected, and default stores in priority order', () => {
    expect(resolveCheckoutStoreSlug({ hostedSlug: 'host', storefrontSlug: 'path', selectedSlug: 'selected' })).toBe('host');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: 'path', selectedSlug: 'selected' })).toBe('path');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, selectedSlug: 'selected' })).toBe('selected');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, selectedSlug: null })).toBe('teajia-bali');
  });

  it('allows an empty or same-store cart and rejects a different store', () => {
    expect(canAddToStoreCart([], bali)).toEqual({ allowed: true });
    expect(canAddToStoreCart([bali], { ...bali, id: 'tea-3' })).toEqual({ allowed: true });
    expect(canAddToStoreCart([bali], australia)).toMatchObject({
      allowed: false,
      existingStoreSlug: 'teajia-bali',
      incomingStoreSlug: 'teajia-australia',
    });
  });

  it('rejects mixed or unscoped carts before checkout', () => {
    expect(validateStoreCart([bali])).toEqual({ ok: true, storeSlug: 'teajia-bali' });
    expect(validateStoreCart([bali, australia])).toMatchObject({ ok: false, reason: 'mixed_store' });
    expect(validateStoreCart([{ ...bali, storeSlug: '' }])).toMatchObject({ ok: false, reason: 'missing_store' });
  });
});
