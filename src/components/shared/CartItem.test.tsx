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
  it('shows the pack sizes on the row, marks the chosen one, and exposes remove', () => {
    const html = render();
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="50g pack/);
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

describe('the photo leads only when the tea has one', () => {
  const renderWith = (image?: string) => renderToStaticMarkup(
    <MemoryRouter>
      <CartItemRow item={{ ...item, image }} onRemove={() => {}} onUpdateQuantity={() => {}} onUpdatePacks={() => {}} />
    </MemoryRouter>,
  );
  it('draws no image and no empty plate for a tea without a photo', () => {
    expect(renderWith(undefined)).not.toContain('<img');
    expect(renderWith('')).not.toContain('<img');
  });
  it('draws the photo above the name when there is one', () => {
    const html = renderWith('https://example.com/leaf.jpg');
    expect(html).toContain('src="https://example.com/leaf.jpg"');
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('Red tea</a>'));
  });
});
