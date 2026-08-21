import type { CartItem } from '../types';

export const DEFAULT_STORE_SLUG = 'teajia-bali';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function createInquiryPayloadKey(input: {
  storeSlug: string;
  name: string;
  contact: string;
  location: string;
  notes: string;
  cart: CartItem[];
  totalUsd: number;
  currency: string;
}): string {
  return JSON.stringify(stableValue({
    storeSlug: input.storeSlug,
    name: input.name.trim(),
    contact: input.contact.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
    cart: input.cart,
    totalUsd: input.totalUsd,
    currency: input.currency.trim().toUpperCase(),
  }));
}

export function shouldRotateInquiryIdentity(
  persistedPayloadKey: string | null,
  currentPayloadKey: string,
  reopenedAfterPersistence: boolean,
): boolean {
  return persistedPayloadKey !== null
    && (reopenedAfterPersistence || persistedPayloadKey !== currentPayloadKey);
}

export interface DeliveryPlaceholder {
  opener: unknown;
  location: { href: string };
  close: () => void;
}

export function openDeliveryPlaceholder(
  open: () => DeliveryPlaceholder | null = () => window.open('about:blank', '_blank') as DeliveryPlaceholder | null,
): DeliveryPlaceholder | null {
  const popup = open();
  if (!popup) return null;
  try {
    popup.opener = null;
    return popup;
  } catch {
    try { popup.close(); } catch { /* best effort */ }
    return null;
  }
}

export function navigateDeliveryPlaceholder(popup: DeliveryPlaceholder, href: string): boolean {
  try {
    popup.location.href = href;
    return true;
  } catch {
    try { popup.close(); } catch { /* best effort */ }
    return false;
  }
}

export function copyDeliveryStep(isPersistedForPayload: boolean): 'persist' | 'copy' {
  return isPersistedForPayload ? 'copy' : 'persist';
}

export function createTrackingToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createHumanOrderRef(
  date = new Date(),
  uuid = () => crypto.randomUUID(),
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const suffix = uuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `TJ-${year}${month}${day}-${suffix}`;
}

export function resolveCheckoutStoreSlug(input: {
  hostedSlug: string | null;
  storefrontSlug: string | null;
  querySelectedSlug: string | null;
  selectedSlug: string | null;
}): string {
  return input.hostedSlug
    || input.storefrontSlug
    || input.querySelectedSlug
    || input.selectedSlug
    || DEFAULT_STORE_SLUG;
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

export function resolveCartContactStoreSlug(
  cart: CartItem[],
  browsingStoreSlug: string,
): string | null {
  const validation = validateStoreCart(cart);
  if (validation.ok) return validation.storeSlug;
  return validation.reason === 'empty' ? browsingStoreSlug : null;
}

export function shouldFetchCheckoutStore(input: {
  hasCart: boolean;
  isCommerceRoute: boolean;
  hostedSlug: string | null;
  contactStoreSlug: string | null;
}): boolean {
  return !!input.contactStoreSlug
    && (input.hasCart || input.isCommerceRoute || !!input.hostedSlug);
}
