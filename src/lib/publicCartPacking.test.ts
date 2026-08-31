import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, cartLineKey } from './store';
import { buildOrderMessage } from './whatsapp';
import type { CartItem } from '../types';

/**
 * Two small packs are not one big pack.
 *
 * The order used to hold a weight per tea and nothing else, so a second 25 g
 * merged into the first and the line came back as 50 g priced on the 50 g rung
 * of the discount curve: a cheaper price for a thing the shop had not been
 * asked to send, and no way at all to ask for two packs. The discount is for
 * the bigger pack, so these tests pin the arithmetic as well as the shape.
 */

const tea = (grams: number): CartItem => ({
  id: 'tuo',
  name: '1998 Small Tuo',
  variant: '',
  category: 'tea',
  storeSlug: 'teajia-bali',
  storeName: 'Teajia Bali',
  quantityGrams: grams,
  packGrams: grams,
  packs: 1,
  pricePerGram: 0.5,
  totalPrice: 0,
});

const cart = () => useAppStore.getState().publicCart;

describe('packing an order line', () => {
  beforeEach(() => {
    useAppStore.getState().clearPublicCart();
  });

  it('adds a second pack rather than a heavier one', () => {
    const { addToPublicCart } = useAppStore.getState();
    addToPublicCart(tea(25));
    const onePack = cart()[0].totalPrice;

    addToPublicCart(tea(25));

    expect(cart()).toHaveLength(1);
    expect(cart()[0].packs).toBe(2);
    expect(cart()[0].quantityGrams).toBe(50);
    // The price of two packs, and NOT the price of the 50 g pack, which the
    // curve discounts and which nobody asked for.
    expect(cart()[0].totalPrice).toBe(onePack * 2);
  });

  it('charges more for two small packs than for one big one', () => {
    const { addToPublicCart, clearPublicCart } = useAppStore.getState();
    addToPublicCart(tea(50));
    const oneBigPack = cart()[0].totalPrice;

    clearPublicCart();
    addToPublicCart(tea(25));
    addToPublicCart(tea(25));

    expect(cart()[0].totalPrice).toBeGreaterThan(oneBigPack);
  });

  it('gives a different pack size its own line', () => {
    const { addToPublicCart } = useAppStore.getState();
    addToPublicCart(tea(25));
    addToPublicCart(tea(100));

    expect(cart().map(l => l.lineKey)).toEqual([cartLineKey('tuo', 25), cartLineKey('tuo', 100)]);
    expect(cart().every(l => l.packs === 1)).toBe(true);
  });

  it('keeps the number of packs when the pack size changes', () => {
    const { addToPublicCart, updatePublicCartQuantity } = useAppStore.getState();
    addToPublicCart(tea(25));
    addToPublicCart(tea(25));

    updatePublicCartQuantity(cartLineKey('tuo', 25), 50);

    expect(cart()).toHaveLength(1);
    expect(cart()[0].packGrams).toBe(50);
    expect(cart()[0].packs).toBe(2);
    expect(cart()[0].quantityGrams).toBe(100);
  });

  it('folds a resize onto a size the order already holds', () => {
    const { addToPublicCart, updatePublicCartQuantity } = useAppStore.getState();
    addToPublicCart(tea(25));
    addToPublicCart(tea(100));

    updatePublicCartQuantity(cartLineKey('tuo', 100), 25);

    expect(cart()).toHaveLength(1);
    expect(cart()[0].packGrams).toBe(25);
    expect(cart()[0].packs).toBe(2);
  });

  it('never drops below one pack', () => {
    const { addToPublicCart, updatePublicCartPacks } = useAppStore.getState();
    addToPublicCart(tea(25));

    updatePublicCartPacks(cartLineKey('tuo', 25), 0);

    expect(cart()[0].packs).toBe(1);
  });

  it('reads a line saved before packing as one pack of its weight', () => {
    const { addToPublicCart } = useAppStore.getState();
    const legacy = { ...tea(25), packGrams: undefined, packs: undefined, lineKey: undefined };
    addToPublicCart(legacy);
    addToPublicCart(tea(25));

    expect(cart()).toHaveLength(1);
    expect(cart()[0].packs).toBe(2);
  });
});

describe('the request message', () => {
  it('says how many packs, so the shop is not asked for a merged weight', () => {
    const message = buildOrderMessage({
      type: 'inquiry',
      items: [{ name: '1998 Small Tuo', quantity: 25, packs: 2, unit: 'g', price: '$8', total: '$16' }],
      subtotal: '$16',
      total: '$16',
    });

    expect(message).toContain('2 × 25g');
  });

  it('says nothing extra for a single pack', () => {
    const message = buildOrderMessage({
      type: 'inquiry',
      items: [{ name: '1998 Small Tuo', quantity: 50, packs: 1, unit: 'g', price: '$14', total: '$29' }],
      subtotal: '$29',
      total: '$29',
    });

    expect(message).toContain('1998 Small Tuo: 50g');
    expect(message).not.toContain('1 ×');
  });
});
