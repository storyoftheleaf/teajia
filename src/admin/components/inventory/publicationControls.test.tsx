import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { InventoryBulkToolbar } from './InventoryBulkToolbar';
import { QuickEditFields } from './QuickEditFields';

const incomingProduct: Product = {
  id: 'incoming-tea', type: 'Oolong', givenName: 'Incoming tea', productName: 'Incoming tea',
  originCountry: 'China', originRegion: 'Wuyi', pricePerGramUSD: 0.4, costPerGramUSD: 0.1,
  costAmount: 100, stockGrams: 0, lowStockThreshold: 50, description: 'Incoming.', tastingNotes: [],
  imageUrl: '', status: 'Active', costCurrency: 'USD', quantityPurchased: 1000,
  isPersonal: false, canReorder: true, isPublic: false, shownInShop: false,
};

describe('inventory publication controls', () => {
  it('disables quick-edit publication when arrival status is not ready', () => {
    const html = renderToStaticMarkup(
      <QuickEditFields
        product={incomingProduct}
        cols={[{ key: 'productName', width: 'w-full' }]}
        onUpdate={vi.fn()}
        onTasting={vi.fn()}
        onFullEdit={vi.fn()}
        rates={[]}
        canPublish={false}
      />,
    );
    expect(html).toMatch(/aria-label="Show in shop"[^>]*disabled=""/);
    expect(html).toContain('Arrival status must be ready before publication');
  });

  it('disables bulk Apply when a public change is ineligible', () => {
    const html = renderToStaticMarkup(
      <InventoryBulkToolbar
        selectedCount={1}
        isEditMode
        splitView={false}
        bulkField="isPublic"
        bulkValue="true"
        isBulkApplying={false}
        canApply={false}
        onBulkFieldChange={vi.fn()}
        onBulkValueChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(html).toMatch(/disabled=""[^>]*title="Arrival status must be ready before publication"/);
  });
});
