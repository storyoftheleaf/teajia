import { describe, expect, it } from 'vitest';
import type { EligibleSalesProduct } from '../../lib/api';
import type { Product } from '../types';
import {
  buildEligibleQuickInvoiceSuggestions,
  quickInvoiceStockLabel,
  validateQuickInvoiceLinkedItems,
} from './QuickInvoiceModal';

const product = (id: string, name: string): Product => ({
  id, givenName: name, productName: name, type: 'Oolong', status: 'Active', form: 'Loose',
  originCountry: '', originRegion: '', pricePerGramUSD: 0.4, costPerGramUSD: 0,
  costAmount: 0, stockGrams: 999, lowStockThreshold: 0, description: '', tastingNotes: [],
  imageUrl: '', costCurrency: 'USD', quantityPurchased: 0, isPersonal: false,
  canReorder: false, isPublic: false, shownInShop: false,
});

const eligible = (productId: string, overrides: Partial<EligibleSalesProduct> = {}): EligibleSalesProduct => ({
  product_id: productId,
  product_name: productId,
  owner_id: null,
  owner_name: null,
  physical_quantity: 50,
  held_quantity: 8,
  available_quantity: 42,
  price_floor: null,
  grant_id: null,
  permission_reason: 'account_owner',
  ...overrides,
});

describe('Quick Invoice sales eligibility', () => {
  it('projects suggestions only from eligible rows', () => {
    const suggestions = buildEligibleQuickInvoiceSuggestions(
      [product('house', 'House Oolong'), product('private', 'Private Oolong')],
      [eligible('private', { owner_id: 'owner-1', owner_name: 'Mei Lin', available_quantity: 12, price_floor: 0.3 })],
    );

    expect(suggestions.map(suggestion => suggestion.productId)).toEqual(['private']);
    expect(quickInvoiceStockLabel(suggestions[0].eligibility)).toBe('Mei Lin · 12g available · floor $0.30/g');
  });

  it('defensively limits malformed eligibility responses to local active tea products', () => {
    const draft = { ...product('draft', 'Draft Tea'), status: 'Draft' as const };
    const archived = { ...product('archived', 'Archived Tea'), status: 'Archived' as const };
    const teaware = { ...product('tray', 'Tea Tray'), type: 'Teaware' as const };
    const misc = { ...product('misc', 'Misc Item'), type: 'Misc' as const };
    const missing = { ...product('missing', 'Missing Type'), type: 'MISSING_TYPE' as const };
    const unclassified = { ...product('unclassified', 'Unclassified'), type: '' as Product['type'] };
    const suggestions = buildEligibleQuickInvoiceSuggestions(
      [product('active', 'Active Tea'), draft, archived, teaware, misc, missing, unclassified],
      [eligible('active'), eligible('draft'), eligible('archived'), eligible('tray'), eligible('misc'), eligible('missing'), eligible('unclassified')],
    );
    expect(suggestions.map(suggestion => suggestion.productId)).toEqual(['active']);
  });

  it('labels location-owned inventory as House stock and never uses physical total', () => {
    const row = eligible('house', { physical_quantity: 100, held_quantity: 35, available_quantity: 65 });
    expect(quickInvoiceStockLabel(row)).toBe('House stock · 65g available');
    expect(quickInvoiceStockLabel(row)).not.toContain('100');
  });

  it('blocks repeated linked quantities that exceed aggregate availability', () => {
    const error = validateQuickInvoiceLinkedItems([
      { name: 'House Oolong', productId: 'house', quantity: 7, price: 0.4 },
      { name: 'House Oolong refill', productId: 'house', quantity: 6, price: 0.4 },
    ], 'ready', [eligible('house', { available_quantity: 12 })]);

    expect(error).toBe('House Oolong has 12g available; this invoice links 13g.');
  });

  it('blocks a linked price below its grant floor', () => {
    const error = validateQuickInvoiceLinkedItems(
      [{ name: 'Private Oolong', productId: 'private', quantity: 5, price: 0.29 }],
      'ready',
      [eligible('private', { price_floor: 0.3 })],
    );
    expect(error).toBe('Private Oolong must be priced at $0.30/g or above.');
  });

  it('keeps no-longer-eligible linked items unavailable instead of treating them as custom', () => {
    const error = validateQuickInvoiceLinkedItems(
      [{ name: 'Private Oolong', productId: 'private', quantity: 5, price: 0.4 }],
      'ready',
      [],
    );
    expect(error).toBe('Private Oolong is no longer eligible for linked stock. Choose an eligible product or remove the line.');
  });

  it('fails closed while eligibility is loading or unavailable, but permits custom lines', () => {
    const linked = [{ name: 'House Oolong', productId: 'house', quantity: 5, price: 0.4 }];
    const custom = [{ name: 'Tea service', quantity: 1, price: 20 }];
    expect(validateQuickInvoiceLinkedItems(linked, 'loading', [])).toBe('Sales inventory is still loading. Retry before saving linked stock.');
    expect(validateQuickInvoiceLinkedItems(linked, 'error', [])).toBe('Sales inventory could not be verified. Retry before saving linked stock.');
    expect(validateQuickInvoiceLinkedItems(custom, 'error', [])).toBeNull();
  });
});
