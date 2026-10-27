import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import { useInventoryProducts } from './useInventoryProducts';

const tea = (id: string, overrides: Partial<Product> = {}): Product => ({
  id, type: 'Oolong', givenName: '', productName: 'Mountain tea', originCountry: 'Taiwan', originRegion: 'Alishan',
  pricePerGramUSD: .4, costPerGramUSD: .1, costAmount: 100, stockGrams: 100, lowStockThreshold: 50,
  description: 'A mountain tea.', tastingNotes: [], imageUrl: '', status: 'Active', costCurrency: 'USD',
  quantityPurchased: 1000, isPersonal: false, canReorder: true, isPublic: false, shownInShop: false,
  inventoryPurpose: 'sample', ...overrides,
});

const products = [
  tea('sample-tasted'),
  tea('sample-untasted'),
  tea('working-untasted', { inventoryPurpose: 'working' }),
  tea('red-untasted', { type: 'Red' }),
];

function read(overrides: Partial<Parameters<typeof useInventoryProducts>[0]> = {}) {
  let result: ReturnType<typeof useInventoryProducts> | undefined;
  function Capture() {
    result = useInventoryProducts({
      localProducts: products, inventoryCategory: 'tea', searchQuery: '', filterType: 'All',
      inventorySortConfig: [], inventoryColumns: [], inventoryGroupBy: 'vendor', priceMode: 'retail', isEditMode: false,
      personalTastingByProductId: { 'sample-tasted': { count: 1 } }, ...overrides,
    });
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return result!;
}

describe('independent Stock filters', () => {
  it('combines purpose, tea type and personal tasting state', () => {
    expect(read({ filterType: 'Samples', teaTypeFilter: 'Oolong', tastingFilter: 'Untasted' }).processedProducts.map(product => product.id)).toEqual(['sample-untasted']);
    expect(read({ filterType: 'Samples', teaTypeFilter: 'Oolong', tastingFilter: 'Tasted' }).processedProducts.map(product => product.id)).toEqual(['sample-tasted']);
  });

  it('keeps the tea type and purpose constraints when searching', () => {
    expect(read({ searchQuery: 'Mountain tea', teaTypeFilter: 'Red', filterType: 'Samples', tastingFilter: 'Untasted' }).processedProducts.map(product => product.id)).toEqual(['red-untasted']);
  });

  it('does not classify unavailable tasting summaries as untasted', () => {
    expect(read({ filterType: 'Samples', teaTypeFilter: 'Oolong', tastingFilter: 'Untasted', summaryStatus: 'loading' }).processedProducts.map(product => product.id)).toEqual(['sample-tasted', 'sample-untasted']);
  });

  it('can combine purchase purpose with a product tasting profile filter', () => {
    const localProducts = [tea('with-profile', { tastingSource: 'owner', tasting: { aroma: ['Orchid'] } }), tea('without-profile')];
    expect(read({ localProducts, filterType: 'Samples', tastingFilter: 'HasProductTasting' }).processedProducts.map(product => product.id)).toEqual(['with-profile']);
    expect(read({ localProducts, filterType: 'Samples', tastingFilter: 'NeedsProductTasting' }).processedProducts.map(product => product.id)).toEqual(['without-profile']);
  });

  it('shows blank and whitespace-only suppliers as Unknown without changing products', () => {
    const localProducts = [tea('blank', { vendor: '' }), tea('whitespace', { vendor: '   ' }), tea('missing')];
    const groups = read({ localProducts }).groupedProducts!;
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Unknown');
    expect(groups[0].items).toHaveLength(3);
    expect(localProducts[1].vendor).toBe('   ');
  });
});
