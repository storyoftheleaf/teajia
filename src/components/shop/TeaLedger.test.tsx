import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryItem } from '../../types';
import { TeaLedger } from './TeaLedger';

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

const item = (overrides: Partial<InventoryItem> = {}) => ({
  id: 'tea-1',
  name: 'A Very Long Tea Name That Must Wrap Without Being Cut Off',
  type: 'Oolong',
  category: 'tea',
  year: null,
  origin: 'Wuyi Mountains, Fujian, China',
  price_per_gram: '0.22',
  stock_g: 300,
  isFeatured: false,
  ...overrides,
}) as InventoryItem;

function renderLedger(product: InventoryItem, isAdmin = false): string {
  return renderToStaticMarkup(
    <TeaLedger
      groups={[{ type: 'Oolong', items: [product] }]}
      activeType="All"
      specialFilter="None"
      tastingCounts={new Map()}
      priceWeight={50}
      formatPrice={price => `$${price.toFixed(2)}`}
      favoriteIds={new Set(product.id === 'tea-1' && product.year === '1998' ? ['tea-1'] : [])}
      onToggleFavorite={() => {}}
      onOpenProduct={() => {}}
      isAdmin={isAdmin}
      onAdminEdit={isAdmin ? () => {} : undefined}
    />,
  );
}

describe('TeaLedger year favorite control', () => {
  it('keeps the shared stock-aware pack quote without offering a one-click purchase', () => {
    const html = renderLedger(item({ price_per_gram: '0.21', stock_g: 30 }));
    expect(html).toContain('$9.00');
    expect(html).toContain('30g');
    expect(html).not.toContain('Add one');
    expect(html).not.toContain('Add to cart');
  });

  it('declines to quote an unavailable tea', () => {
    const html = renderLedger(item({ stock_g: 0 }));
    expect(html).toContain('Unavailable');
    expect(html).toContain('Sold out');
    expect(html).not.toContain('$');
  });

  it('keeps an unknown year usable and renders the complete, wrapping title', () => {
    const html = renderLedger(item());

    expect(html).toContain('aria-label="Save A Very Long Tea Name That Must Wrap Without Being Cut Off"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('title="Save tea"');
    expect(html).toContain('>Save</span>');
    expect(html).toContain('>—</span>');
    expect(html).toContain('A Very Long Tea Name That Must Wrap Without Being Cut Off');
    expect(html).not.toContain('line-clamp-2');
    expect(html).not.toContain('Unsave A Very Long');
  });

  it('keeps the year visible when saved and keeps owner editing in lower metadata', () => {
    const html = renderLedger(item({ year: '1998' }), true);

    expect(html).toContain('aria-label="Unsave A Very Long Tea Name That Must Wrap Without Being Cut Off"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('title="Saved. Click to unsave"');
    expect(html).toContain('Saved</span>');
    expect(html).toContain('1998');
    expect(html).toContain('aria-label="Edit A Very Long Tea Name That Must Wrap Without Being Cut Off"');
    expect(html).not.toContain('line-clamp-2');
  });

});

const chooserItem = item({ id: 'red', name: 'Red tea', type: 'Red', year: '', origin: '', price_per_gram: '0.21', stock_g: 200 });
const props = () => ({
  groups: [{ type: 'Red', items: [chooserItem] }], activeType: 'All', specialFilter: 'None',
  tastingCounts: new Map<string, number>(), priceWeight: 50, formatPrice: (usd: number) => `$${usd}`,
  favoriteIds: new Set<string>(), onToggleFavorite: vi.fn(), onOpenProduct: vi.fn(), onChooseAmount: vi.fn(),
});
function elements(node: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<Record<string, any>>(child)) return [];
    return [child, ...elements(child.props.children)];
  });
}

describe('catalogue quantity chooser', () => {
  it('shows the full pack price and its actual weight', () => {
    const html = renderToStaticMarkup(<TeaLedger {...props()} />);
    expect(html).toContain('Choose amount for Red tea');
    expect(html).toContain('50g');
  });
  it('opens the amount chooser without also opening the tea', () => {
    const p = props();
    const nodes = elements(TeaLedger(p));
    const add = nodes.find(node => node.props['aria-label'] === 'Choose amount for Red tea')!;
    const stopPropagation = vi.fn();
    add.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(p.onChooseAmount).toHaveBeenCalledWith(chooserItem);
    expect(p.onOpenProduct).not.toHaveBeenCalled();
  });
  it('does not let child keyboard events open the row', () => {
    const p = props();
    const nodes = elements(TeaLedger(p));
    const row = nodes.find(node => node.props['aria-label'] === 'View Red tea')!;
    const target = {};
    row.props.onKeyDown({ key: 'Enter', target, currentTarget: {}, preventDefault: vi.fn() });
    expect(p.onOpenProduct).not.toHaveBeenCalled();
    row.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault: vi.fn() });
    expect(p.onOpenProduct).toHaveBeenCalledWith(chooserItem);
  });
  it('does not offer an amount chooser for unavailable tea', () => {
    const p = props();
    p.groups[0].items = [{ ...chooserItem, stock_g: 0 }];
    const html = renderToStaticMarkup(<TeaLedger {...p} />);
    expect(html).not.toContain('Choose amount for');
  });
});
