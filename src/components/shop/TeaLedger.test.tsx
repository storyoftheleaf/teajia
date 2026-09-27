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
