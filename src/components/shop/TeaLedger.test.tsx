import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryItem } from '../../types';
import { TeaLedger } from './TeaLedger';
import { TeaWeighControl, startingIndex, weighOptions } from './TeaWeighControl';

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

function renderLedger(product: InventoryItem): string {
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
    />,
  );
}

describe('TeaLedger year favorite control', () => {
  it('keeps the shared stock-aware pack quote, capped at what is in stock', () => {
    const html = renderLedger(item({ price_per_gram: '0.21', stock_g: 30 }));
    expect(html).toContain('$9.00');
    expect(html).toContain('30g');
    expect(html).not.toContain('Add one');
  });

  it('declines to quote an unavailable tea', () => {
    const html = renderLedger(item({ stock_g: 0 }));
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

  it('keeps the year visible when saved, with no owner Edit on the list (it lives on the tea page)', () => {
    const html = renderLedger(item({ year: '1998' }));

    expect(html).toContain('aria-label="Unsave A Very Long Tea Name That Must Wrap Without Being Cut Off"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('title="Saved. Click to unsave"');
    expect(html).toContain('Saved</span>');
    expect(html).toContain('1998');
    expect(html).not.toContain('aria-label="Edit ');
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
  it('hands the weigh control the amount chooser and the direct add', () => {
    const p = { ...props(), onAddToCart: vi.fn() };
    const nodes = elements(TeaLedger(p));
    const control = nodes.find(node => node.type === TeaWeighControl)!;
    expect(control.props.item).toBe(chooserItem);
    expect(control.props.preferredGrams).toBe(50);
    expect(control.props.onChooseAmount).toBe(p.onChooseAmount);
    expect(control.props.onAddToCart).toBe(p.onAddToCart);
  });
  it('steps through the shop sizes the tea can actually be sold in', () => {
    expect(weighOptions(chooserItem).map(o => o.grams)).toEqual([10, 25, 50, 100, 200]);
    expect(weighOptions(item({ stock_g: 60 })).map(o => o.grams)).toEqual([10, 25, 50, 60]);
    const sealed = item({ stock_g: 350, form: 'Box', pieceWeightG: 100, soldInWholeUnits: true } as Partial<InventoryItem>);
    expect(weighOptions(sealed).map(o => o.grams)).toEqual([100, 200]);
  });
  it('starts on the weight the shop header is pricing at', () => {
    const options = weighOptions(chooserItem);
    expect(options[startingIndex(options, 50)].grams).toBe(50);
    expect(options[startingIndex(options, 100)].grams).toBe(100);
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
