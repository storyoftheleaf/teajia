import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { fmtShopPrice, fmtShopPricePerGram } from '../../utils/formatNumber';
import { AlcoveCommerceFooter } from './alcove/AlcoveCommerceFooter';

const item = {
  id: 'tea-1',
  category: 'tea',
  type: 'White',
  name: 'Tea',
  year: '2024',
  origin: 'Fujian',
  stock_g: 100,
  cost_price: '0',
  price_per_gram: '0.15',
  description: '',
  tags: [],
} as any;

const footerProps = {
  item,
  alcoveBg: 'var(--tea-bg)',
  stockStatus: { label: 'In Stock', color: 'var(--tea-leaf)', level: 'ok' as const },
  isSoldOut: false,
  grams: 50,
  setGrams: () => {},
  sampleMode: false,
  setSampleMode: () => {},
  customMode: false,
  setCustomMode: () => {},
  sliderMax: 100,
  presets: [25, 50, 100],
  pricePerGram: 0.15,
  total: '$8',
  added: false,
  shareCopied: false,
  favorited: false,
  inSampleCart: false,
  toggleFavoriteTea: () => {},
  toggleSampleCart: () => {},
  handleShare: () => {},
  handleAdd: () => {},
  formatPrice: () => '$8',
};

describe('shop price roles', () => {
  it('does not format a fractional rate as a whole-dollar total', () => {
    expect(fmtShopPrice(0.15)).toBe('$1');
    expect(fmtShopPricePerGram(0.15)).toBe('$0.15/g');
  });

  it('renders a complete per-gram rate exactly once', () => {
    const html = renderToStaticMarkup(
      <AlcoveCommerceFooter {...footerProps} rateLabel="$0.15/g" />,
    );

    expect(html.match(/\$0\.15\/g/g)).toHaveLength(1);
    expect(html).not.toContain('/g/g');
  });
});

describe('cold product page order access', () => {
  const loadControl = async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    return (await import('../../pages/ProductPage')).ProductOrderAccess;
  };

  it('reopens a populated order from the commerce reassurance area', async () => {
    const ProductOrderAccess = await loadControl();
    expect(ProductOrderAccess).toBeTypeOf('function');
    const onCartClick = vi.fn();
    const control = ProductOrderAccess!({ cartItemCount: 2, onCartClick });
    const html = renderToStaticMarkup(control);

    expect(html).toContain('View order');
    expect(html).toContain('Open order with 2 items');
    (control as React.ReactElement<{ onClick: () => void }>).props.onClick();
    expect(onCartClick).toHaveBeenCalledOnce();
  });

  it('stays absent until an order has an item', async () => {
    const ProductOrderAccess = await loadControl();
    expect(ProductOrderAccess!({ cartItemCount: 0, onCartClick: () => {} })).toBeNull();
  });
});
