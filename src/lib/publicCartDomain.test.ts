import { describe, expect, it } from 'vitest';
import {
  canAddToStoreCart,
  copyDeliveryStep,
  createHumanOrderRef,
  createInquiryPayloadKey,
  createTrackingToken,
  navigateDeliveryPlaceholder,
  openDeliveryPlaceholder,
  shouldRotateInquiryIdentity,
  resolveCartContactStoreSlug,
  resolveCheckoutStoreSlug,
  shouldFetchCheckoutStore,
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
  it('resolves hosted, path, query, persisted, and default stores in priority order', () => {
    expect(resolveCheckoutStoreSlug({ hostedSlug: 'host', storefrontSlug: 'path', querySelectedSlug: 'query', selectedSlug: 'selected' })).toBe('host');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: 'path', querySelectedSlug: 'query', selectedSlug: 'selected' })).toBe('path');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, querySelectedSlug: 'query', selectedSlug: 'selected' })).toBe('query');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, querySelectedSlug: null, selectedSlug: 'selected' })).toBe('selected');
    expect(resolveCheckoutStoreSlug({ hostedSlug: null, storefrontSlug: null, querySelectedSlug: null, selectedSlug: null })).toBe('teajia-bali');
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

  it('keeps checkout contacts bound to a valid cart store', () => {
    expect(resolveCartContactStoreSlug([bali], 'teajia-australia')).toBe('teajia-bali');
    expect(resolveCartContactStoreSlug([], 'teajia-australia')).toBe('teajia-australia');
  });

  it('does not resolve checkout contacts for an invalid cart', () => {
    expect(resolveCartContactStoreSlug([bali, australia], 'teajia-australia')).toBeNull();
    expect(resolveCartContactStoreSlug([{ ...bali, storeSlug: '' }], 'teajia-australia')).toBeNull();
  });

  it('fetches a store only where commerce or a bound cart needs it', () => {
    expect(shouldFetchCheckoutStore({ hasCart: false, isCommerceRoute: false, hostedSlug: null, contactStoreSlug: 'teajia-bali' })).toBe(false);
    expect(shouldFetchCheckoutStore({ hasCart: true, isCommerceRoute: false, hostedSlug: null, contactStoreSlug: 'teajia-bali' })).toBe(true);
    expect(shouldFetchCheckoutStore({ hasCart: false, isCommerceRoute: true, hostedSlug: null, contactStoreSlug: 'teajia-bali' })).toBe(true);
    expect(shouldFetchCheckoutStore({ hasCart: false, isCommerceRoute: false, hostedSlug: 'teajia-australia', contactStoreSlug: 'teajia-australia' })).toBe(true);
    expect(shouldFetchCheckoutStore({ hasCart: true, isCommerceRoute: true, hostedSlug: null, contactStoreSlug: null })).toBe(false);
  });
});

describe('public cart inquiry identity', () => {
  it('creates a private 32-byte base64url tracking token', () => {
    const token = createTrackingToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain('=');
  });

  it('creates a human reference from the date and the first eight UUID characters', () => {
    const ref = createHumanOrderRef(
      new Date('2026-08-10T09:15:00.000Z'),
      () => 'a1b2c3d4-e5f6-4789-abcd-0123456789ab',
    );

    expect(ref).toBe('TJ-20260810-A1B2C3D4');
  });

  it('creates distinct human references on the same date from distinct UUIDs', () => {
    const date = new Date('2026-08-10T09:15:00.000Z');

    expect(createHumanOrderRef(date, () => '11111111-e5f6-4789-abcd-0123456789ab'))
      .not.toBe(createHumanOrderRef(date, () => '22222222-e5f6-4789-abcd-0123456789ab'));
  });

  it('rotates only after persistence when payload changes or checkout reopens', () => {
    expect(shouldRotateInquiryIdentity(null, 'payload-a', false)).toBe(false);
    expect(shouldRotateInquiryIdentity('payload-a', 'payload-a', false)).toBe(false);
    expect(shouldRotateInquiryIdentity('payload-a', 'payload-b', false)).toBe(true);
    expect(shouldRotateInquiryIdentity('payload-a', 'payload-a', true)).toBe(true);
  });

  it('creates a stable payload key that changes with inquiry content', () => {
    const base = { storeSlug: 'bali', name: 'Lin', contact: 'lin@example.com', location: 'Bali', notes: '', cart: [bali], totalUsd: 25, currency: 'USD' };
    expect(createInquiryPayloadKey(base)).toBe(createInquiryPayloadKey({ ...base }));
    expect(createInquiryPayloadKey(base)).not.toBe(createInquiryPayloadKey({ ...base, notes: 'Gift wrap' }));
  });
});

describe('public cart delivery activation', () => {
  it('reports a blocked popup without claiming a delivery window', () => {
    expect(openDeliveryPlaceholder(() => null)).toBeNull();
  });

  it('severs opener access and navigates a synchronous placeholder', () => {
    const popup = { opener: { unsafe: true }, location: { href: 'about:blank' }, close: () => undefined };
    const opened = openDeliveryPlaceholder(() => popup);

    expect(opened?.opener).toBeNull();
    expect(navigateDeliveryPlaceholder(opened!, 'https://wa.me/example')).toBe(true);
    expect(popup.location.href).toBe('https://wa.me/example');
  });

  it('uses the first copy click to persist and the next fresh gesture to copy', () => {
    expect(copyDeliveryStep(false)).toBe('persist');
    expect(copyDeliveryStep(true)).toBe('copy');
  });
});
