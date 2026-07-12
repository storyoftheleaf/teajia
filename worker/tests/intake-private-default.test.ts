import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stagedToProduct, type StagedItem } from '../../src/admin/lib/intakeMapping';

const staged: StagedItem = {
  id: 'row-1', sourceId: 'file-1', raw: {}, type: 'Green', form: 'Loose',
  givenName: 'Field Green', chineseName: '', productName: 'Field Green', year: '',
  originCountry: 'China', originRegion: '', vendor: 'Vendor', costAmount: 12,
  costCurrency: 'USD', stockGrams: 50, quantityPurchased: 50, quantityUnits: 0,
  teawareCategory: '', sizeEstimate: '50 g', description: '', imageUrl: '',
  isPersonal: false, needsReview: false, include: true, order: 0,
};

describe('structured stock import publication boundary', () => {
  it('always creates a private product even for owner working stock', () => {
    expect(stagedToProduct(staged)).toMatchObject({ status: 'Draft', is_public: false, shown_in_shop: false });
  });

  it('does not couple personal purpose to publication defaults', () => {
    expect(stagedToProduct({ ...staged, isPersonal: true })).toMatchObject({ is_personal: true, is_public: false, shown_in_shop: false });
  });

  it('forces the bulk endpoint private before it builds product, listing, and profile mirrors', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    const handler = source.slice(source.indexOf('const handleBulkCreateProducts'), source.indexOf('const handleUpdateProduct'));
    expect(handler).toContain('body.is_public = 0');
    expect(handler).toContain('body.shown_in_shop = 0');
    expect(handler).toContain('buildProductMirrorInserts(env, id, accountId, body)');
    expect(handler.indexOf('body.is_public = 0')).toBeLessThan(handler.indexOf('buildProductMirrorInserts'));
  });
});
