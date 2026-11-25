import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StockBrowseBar, activeStockChoices } from './StockBrowseBar';

const views = [
  { value: 'default-all', label: 'All', filter: 'All' },
  { value: 'default-samples', label: 'Samples', filter: 'Samples' },
];
const base = { tea: true, type: '', types: ['Oolong'], supplier: '', suppliers: ['HangJia'], view: 'default-all', views, tasting: '' };
const noop = () => {};
const render = (overrides: Partial<typeof base>, onClearAll?: () => void) => renderToStaticMarkup(
  <StockBrowseBar {...base} {...overrides} onType={noop} onSupplier={noop} onView={noop} onTasting={noop} onClearAll={onClearAll} />,
);

describe('stock filters say what they are hiding', () => {
  it('names every narrowing choice in plain words', () => {
    expect(activeStockChoices({ ...base, view: 'default-samples', supplier: 'HangJia', type: 'Oolong', tasting: 'Untasted' }))
      .toEqual(['Stock: Samples', 'Type: Oolong', 'Supplier: HangJia', 'Tasting: To taste']);
    expect(activeStockChoices(base)).toEqual([]);
  });

  it('offers Clear all only while something narrows the list', () => {
    expect(render({ view: 'default-samples' }, noop)).toContain('Showing only Stock: Samples');
    expect(render({ view: 'default-samples' }, noop)).toContain('Clear all');
    expect(render({}, noop)).not.toContain('Clear all');
  });
});
