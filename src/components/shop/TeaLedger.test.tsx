import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TeaLedger } from './TeaLedger';
import type { InventoryItem } from '../../types';

vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
const item = { id: 'red', name: 'Red tea', category: 'tea', type: 'Red', year: '', origin: '', stock_g: 200, price_per_gram: '0.21' } as InventoryItem;
const props = () => ({
  groups: [{ type: 'Red', items: [item] }], activeType: 'All', specialFilter: 'None',
  tastingCounts: new Map<string, number>(), priceWeight: 50, formatPrice: (usd: number) => `$${usd}`,
  favoriteIds: new Set<string>(), onToggleFavorite: vi.fn(), onOpenProduct: vi.fn(), onAddToCart: vi.fn(),
});
function elements(node: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<Record<string, any>>(child)) return [];
    return [child, ...elements(child.props.children)];
  });
}

describe('catalogue quick add', () => {
  it('shows the full pack price and its actual weight', () => {
    const html = renderToStaticMarkup(<TeaLedger {...props()} />);
    expect(html).toContain('Add one 50g pack of Red tea, $13');
    expect(html).toContain('50g pack');
  });
  it('adds a pack without also opening the tea', () => {
    const p = props();
    const nodes = elements(TeaLedger(p));
    const add = nodes.find(node => String(node.props['aria-label']).startsWith('Add one'))!;
    const stopPropagation = vi.fn();
    add.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(p.onAddToCart).toHaveBeenCalledWith(item, 50, 13);
    expect(p.onOpenProduct).not.toHaveBeenCalled();
  });
  it('keeps like independent and does not let child keyboard events open the row', () => {
    const p = props();
    const nodes = elements(TeaLedger(p));
    const like = nodes.find(node => node.props['aria-label'] === 'Like Red tea')!;
    const event = { stopPropagation: vi.fn() };
    like.props.onClick(event);
    expect(p.onToggleFavorite).toHaveBeenCalledWith('red', event);
    expect(event.stopPropagation).toHaveBeenCalled();
    const row = nodes.find(node => node.props['aria-label'] === 'View Red tea')!;
    const target = {};
    row.props.onKeyDown({ key: 'Enter', target, currentTarget: {}, preventDefault: vi.fn() });
    expect(p.onOpenProduct).not.toHaveBeenCalled();
    row.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault: vi.fn() });
    expect(p.onOpenProduct).toHaveBeenCalledWith(item);
  });
  it('does not offer quick add for unavailable tea', () => {
    const p = props();
    p.groups[0].items = [{ ...item, stock_g: 0 }];
    const html = renderToStaticMarkup(<TeaLedger {...p} />);
    expect(html).not.toContain('Add one');
  });
});
