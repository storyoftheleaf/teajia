import type { CartItem } from '../types';

export const DEFAULT_STORE_SLUG = 'teajia-bali';

export function resolveCheckoutStoreSlug(input: {
  hostedSlug: string | null;
  storefrontSlug: string | null;
  selectedSlug: string | null;
}): string {
  return input.hostedSlug || input.storefrontSlug || input.selectedSlug || DEFAULT_STORE_SLUG;
}

export function canAddToStoreCart(cart: CartItem[], item: CartItem) {
  const existing = cart[0];
  if (!existing || existing.storeSlug === item.storeSlug) {
    return { allowed: true as const };
  }

  return {
    allowed: false as const,
    existingStoreSlug: existing.storeSlug,
    incomingStoreSlug: item.storeSlug,
  };
}

export function validateStoreCart(cart: CartItem[]) {
  if (cart.length === 0) {
    return { ok: false as const, reason: 'empty' as const };
  }
  if (cart.some((item) => !item.storeSlug)) {
    return { ok: false as const, reason: 'missing_store' as const };
  }

  const stores = new Set(cart.map((item) => item.storeSlug));
  if (stores.size !== 1) {
    return { ok: false as const, reason: 'mixed_store' as const };
  }

  return { ok: true as const, storeSlug: cart[0].storeSlug };
}
