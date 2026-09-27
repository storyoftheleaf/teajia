import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CartItemRow } from './CartItem';
import type { CartItem } from '../../types';

vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../shop/shopPrice', () => ({
  useShopPrice: () => ({ total: (usd: number) => `$${usd}`, perGramExact: (usd: number) => `$${usd}` }),
}));

const item: CartItem = {
  id: 'red', name: 'Red tea', variant: '', category: 'tea', storeSlug: 'teajia-bali', storeName: 'Bali',
  packGrams: 50, packs: 2, quantityGrams: 100, pricePerGram: 0.2, totalPrice: 24,
};
const render = () => renderToStaticMarkup(
  <MemoryRouter><form>
    <CartItemRow item={item} onRemove={() => {}} onUpdateQuantity={() => {}} onUpdatePacks={() => {}} />
  </form></MemoryRouter>,
);

describe('cart controls inside checkout', () => {
  it('names the pack weight and count and exposes remove without opening an editor', () => {
    const html = render();
    expect(html).toContain('50g per pack');
    expect(html).toContain('2 packs');
    expect(html).toContain('100g in all');
    expect(html).toContain('Remove Red tea from cart');
  });
  it('never submits the checkout form when adjusting a pack', () => {
    const buttons = render().match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    expect(buttons.every(button => button.includes('type="button"'))).toBe(true);
  });
});
