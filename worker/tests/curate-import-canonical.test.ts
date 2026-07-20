import { describe, expect, it } from 'vitest';
import {
  CANONICAL_IMPORT_FIELDS,
  canonicalImportToCompassValues,
  canonicalImportToProductValues,
  normalizeCanonicalImportRecord,
} from '../src/curateImportCanonical';
import { compassValuesFromImport } from '../src/compassCodec';

const reviewedRecord = () => normalizeCanonicalImportRecord({
  sourceId: ' source-a ',
  sourceItemId: ' line-1 ',
  evidenceRefs: ['source-a:12-30', ' source-a:42-50 '],
  sourceExcerpt: '陈年六堡茶380元/500克 x1=380元',
  sourceLanguage: ' zh-CN ',
  englishName: ' Aged Liu Bao Tea ',
  originalName: ' 陈年六堡茶 ',
  category: 'tea',
  type: 'dark tea',
  classification: 'post-fermented tea',
  form: 'loose',
  year: '1998',
  originCountry: ' China ',
  originRegion: ' Guangxi ',
  description: ' Aged Liu Bao tea listed by the supplier. ',
  packWeight: '500',
  weightUnit: 'grams',
  packCount: '1',
  priceAmountExact: '380.00',
  currency: 'rmb',
  priceBasis: 'per_pack',
  lineCostExact: '380.00',
  unitCostExact: '0.76',
  totalQuantityGrams: '500',
  totalUnits: null,
  disposition: 'received',
  inventoryPurpose: 'working',
  vendorResolution: { kind: 'existing', vendorId: 'vendor-a', vendorName: ' Huang Wei ' },
  identityResolution: { kind: 'new' },
  holdingResolution: { kind: 'new' },
});

describe('canonical Curate import record', () => {
  it('normalizes every reviewed field without inventing catalog prose', () => {
    const record = reviewedRecord();

    expect(record).toEqual({
      sourceId: 'source-a',
      sourceItemId: 'line-1',
      evidenceRefs: ['source-a:12-30', 'source-a:42-50'],
      sourceExcerpt: '陈年六堡茶380元/500克 x1=380元',
      sourceLanguage: 'zh-CN',
      englishName: 'Aged Liu Bao Tea',
      originalName: '陈年六堡茶',
      chineseName: '陈年六堡茶',
      category: 'tea',
      type: 'dark tea',
      classification: 'post-fermented tea',
      form: 'loose',
      year: 1998,
      originCountry: 'China',
      originRegion: 'Guangxi',
      description: 'Aged Liu Bao tea listed by the supplier.',
      currency: 'CNY',
      weightUnit: 'g',
      packWeight: 500,
      packCount: 1,
      priceAmountExact: '380',
      priceBasis: 'per_pack',
      lineCostExact: '380',
      unitCostExact: '0.76',
      totalQuantityGrams: 500,
      totalUnits: null,
      disposition: 'received',
      inventoryPurpose: 'working',
      vendorResolution: { kind: 'existing', vendorId: 'vendor-a', vendorName: 'Huang Wei' },
      identityResolution: { kind: 'new' },
      holdingResolution: { kind: 'new' },
    });
    expect(Object.keys(record).sort()).toEqual([...CANONICAL_IMPORT_FIELDS].sort());

    const withoutDescription = normalizeCanonicalImportRecord({
      englishName: 'Aged Liu Bao Tea',
      originalName: '陈年六堡茶',
      sourceExcerpt: '陈年六堡茶',
    });
    expect(withoutDescription.description).toBeNull();
  });

  it('maps camel-case canonical identity, provenance, purchase, and supplier fields to Library columns', () => {
    expect(canonicalImportToCompassValues(reviewedRecord())).toEqual({
      name: 'Aged Liu Bao Tea',
      chinese_name: '陈年六堡茶',
      category: 'tea',
      type: 'dark tea',
      classification: 'post-fermented tea',
      form: 'loose',
      year: 1998,
      origin_country: 'China',
      origin_region: 'Guangxi',
      description: 'Aged Liu Bao tea listed by the supplier.',
      notes: '陈年六堡茶380元/500克 x1=380元',
      vendor_id: 'vendor-a',
      vendor_name: 'Huang Wei',
      price_amount: '380',
      price_currency: 'CNY',
      price_per_unit_grams: '0.76',
      buy_quantity_grams: 500,
      buy_total: '380',
    });
  });

  it('maps every same-purpose identity and intent field to Inventory columns', () => {
    expect(canonicalImportToProductValues(reviewedRecord())).toEqual({
      product_name: 'Aged Liu Bao Tea',
      given_name: 'Aged Liu Bao Tea',
      chinese_name: '陈年六堡茶',
      type: 'dark tea',
      classification: 'post-fermented tea',
      form: 'loose',
      year: '1998',
      origin_country: 'China',
      origin_region: 'Guangxi',
      description: 'Aged Liu Bao tea listed by the supplier.',
      vendor_id: 'vendor-a',
      vendor: 'Huang Wei',
      inventory_purpose: 'working',
    });
  });

  it('keeps provenance and resolution controls canonical without leaking them into destination columns', () => {
    const record = reviewedRecord();
    expect(record).toMatchObject({
      sourceId: 'source-a',
      sourceItemId: 'line-1',
      evidenceRefs: ['source-a:12-30', 'source-a:42-50'],
      sourceExcerpt: '陈年六堡茶380元/500克 x1=380元',
      sourceLanguage: 'zh-CN',
      disposition: 'received',
      identityResolution: { kind: 'new' },
      holdingResolution: { kind: 'new' },
    });
    expect(canonicalImportToCompassValues(record)).not.toHaveProperty('disposition');
    expect(canonicalImportToCompassValues(record)).not.toHaveProperty('identityResolution');
    expect(canonicalImportToProductValues(record)).not.toHaveProperty('holdingResolution');
  });

  it('makes reviewed canonical values authoritative over conflicting legacy snake-case values', () => {
    expect(compassValuesFromImport({
      englishName: 'Canonical English Name',
      originalName: '正名',
      chinese_name: '旧名',
      originCountry: 'China',
      origin_country: 'Taiwan',
      priceAmountExact: '12.50',
      price_amount: 99,
      unitCostExact: '0.125',
      price_per_unit_grams: 88,
      totalQuantityGrams: 100,
      buy_quantity_grams: 999,
      lineCostExact: '12.50',
      buy_total: 999,
      vendorResolution: { kind: 'existing', vendorId: 'canonical-vendor', vendorName: 'Canonical Vendor' },
      vendor_id: 'legacy-vendor',
      vendor_name: 'Legacy Vendor',
    })).toMatchObject({
      name: 'Canonical English Name',
      chinese_name: '正名',
      origin_country: 'China',
      price_amount: '12.5',
      price_per_unit_grams: '0.125',
      buy_quantity_grams: 100,
      buy_total: '12.5',
      vendor_id: 'canonical-vendor',
      vendor_name: 'Canonical Vendor',
    });
  });

  it('uses explicit canonical nulls to clear stale nullable legacy values', () => {
    expect(compassValuesFromImport({
      originalName: null,
      chinese_name: '旧名',
      originCountry: null,
      origin_country: 'Taiwan',
      originRegion: null,
      origin_region: 'Nantou',
      description: null,
      sourceExcerpt: null,
      notes: 'stale excerpt',
      priceAmountExact: null,
      price_amount: 99,
      currency: null,
      price_currency: 'TWD',
      unitCostExact: null,
      price_per_unit_grams: 88,
      totalQuantityGrams: null,
      buy_quantity_grams: 999,
      totalUnits: null,
      buy_quantity_units: 12,
      lineCostExact: null,
      buy_total: 999,
      vendorResolution: null,
      vendor_id: 'legacy-vendor',
      vendor_name: 'Legacy Vendor',
    })).toMatchObject({
      chinese_name: null,
      origin_country: null,
      origin_region: null,
      description: null,
      notes: null,
      price_amount: null,
      price_currency: null,
      price_per_unit_grams: null,
      buy_quantity_grams: null,
      buy_quantity_units: null,
      buy_total: null,
      vendor_id: null,
      vendor_name: null,
    });
  });

  it('preserves snake-case-only Compass import values for backwards compatibility', () => {
    expect(compassValuesFromImport({
      chinese_name: '杉林溪',
      origin_country: 'Taiwan',
      price_amount: 800,
      price_per_unit_grams: 25,
      buy_quantity_grams: 25,
      buy_total: 800,
    })).toMatchObject({
      chinese_name: '杉林溪',
      origin_country: 'Taiwan',
      price_amount: 800,
      price_per_unit_grams: 25,
      buy_quantity_grams: 25,
      buy_total: 800,
    });
  });

  it.each([
    ['received', 'received'],
    ['in-transit', 'in_transit'],
    ['ordered', 'in_transit'],
    ['library-only', 'library_only'],
  ])('normalizes the %s disposition to %s', (input, expected) => {
    expect(normalizeCanonicalImportRecord({ disposition: input }).disposition).toBe(expected);
  });

  it('keeps legacy acquired records safe without inventing a destination for other legacy material', () => {
    expect(normalizeCanonicalImportRecord({ acquired: true }).disposition).toBe('received');
    expect(normalizeCanonicalImportRecord({ acquired: false }).disposition).toBeNull();
    expect(normalizeCanonicalImportRecord({}).disposition).toBeNull();
  });

  it('normalizes kilogram and count quantities without mixing grams and units', () => {
    expect(normalizeCanonicalImportRecord({ packWeight: 0.5, weightUnit: 'kg', packCount: 2 })).toMatchObject({
      totalQuantityGrams: 1000,
      totalUnits: null,
    });
    expect(normalizeCanonicalImportRecord({ packWeight: 3, weightUnit: 'units', packCount: 2 })).toMatchObject({
      totalQuantityGrams: null,
      totalUnits: 6,
    });
  });

  it('recomputes derived quantity from pack facts instead of trusting contradictory totals', () => {
    expect(normalizeCanonicalImportRecord({
      packWeight: 500,
      weightUnit: 'g',
      packCount: 2,
      totalQuantityGrams: 500,
    })).toMatchObject({ totalQuantityGrams: 1000, totalUnits: null });
  });

  it('uses decimal arithmetic for fractional pack quantities without visible drift', () => {
    expect(normalizeCanonicalImportRecord({
      packWeight: 0.1,
      weightUnit: 'kg',
      packCount: 3,
    })).toMatchObject({ totalQuantityGrams: 300, totalUnits: null });
  });

  it('does not treat computed JavaScript money numbers as authoritative exact decimals', () => {
    const computed = 0.1 + 0.2;
    expect(normalizeCanonicalImportRecord({
      priceAmountExact: computed,
      lineCostExact: computed,
      unitCostExact: computed,
    })).toMatchObject({ priceAmountExact: null, lineCostExact: null, unitCostExact: null });
  });

  it('fails a malformed explicit existing-vendor resolution closed', () => {
    expect(normalizeCanonicalImportRecord({
      vendorResolution: { kind: 'existing', vendorName: 'Huang Wei' },
    }).vendorResolution).toEqual({ kind: 'unresolved', vendorName: 'Huang Wei' });
  });

  it('accepts only Teajia-supported ISO 4217 currencies and known source aliases', () => {
    expect(normalizeCanonicalImportRecord({ currency: 'ZZZ' }).currency).toBeNull();
    expect(normalizeCanonicalImportRecord({ currency: 'EUR' }).currency).toBe('EUR');
    expect(normalizeCanonicalImportRecord({ currency: 'NT$' }).currency).toBe('TWD');
  });

  it.each(['¥', '￥', '$'])('keeps the ambiguous standalone %s currency symbol unresolved', symbol => {
    expect(normalizeCanonicalImportRecord({ currency: symbol }).currency).toBeNull();
  });

  it.each(['1e1000000', '1e-1000000'])('bounds hostile decimal exponent input %s without throwing', packWeight => {
    expect(() => normalizeCanonicalImportRecord({ packWeight, weightUnit: 'g', packCount: 1 })).not.toThrow();
    expect(normalizeCanonicalImportRecord({ packWeight, weightUnit: 'g', packCount: 1 }).totalQuantityGrams).toBeNull();
  });
});
