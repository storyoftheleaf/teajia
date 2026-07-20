import { describe, expect, it } from 'vitest';
import {
  applyImportRecordHints,
  buildImportAnalysisPrompt,
  buildImportRecordFallbackProposal,
  buildImportRecordHints,
  decodeImportAnalysisProposal,
  IMPORT_ANALYSIS_OUTPUT_SCHEMA,
  normalizeImportProposal,
  type ImportAnalysisProposal,
} from '../src/curateImportAnalysis';

const item = {
  sourceItemId: 'item-1', category: 'tea' as const, originalName: '云南古树生普',
  englishName: 'Yunnan Ancient Tree Raw Pu’er', packWeight: 500,
  weightUnit: 'g' as const, packCount: 2, priceAmount: '380', currency: 'CNY',
  priceBasis: 'per_pack' as const, confidence: {}, uncertainty: {}, evidenceRefs: ['source-1:0-18'],
  acquired: true, duplicateResolution: 'new' as const,
};

function proposal(overrides: Partial<typeof item> = {}): ImportAnalysisProposal {
  return { overview: '1 tea found', language: 'zh', groups: [{ key: 'chen', proposedVendorName: 'Chen Family Tea', items: [{ ...item, ...overrides }] }] };
}

describe('Curate import analysis domain', () => {
  it('keeps the live provider schema below the Anthropic optional-parameter limit', () => {
    const countOptionalProperties = (schema: unknown): number => {
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return 0;
      const value = schema as Record<string, unknown>;
      let count = 0;
      if (value.properties && typeof value.properties === 'object' && !Array.isArray(value.properties)) {
        const required = new Set(Array.isArray(value.required) ? value.required : []);
        count += Object.keys(value.properties).filter(key => !required.has(key)).length;
      }
      return count + Object.values(value).reduce((total, child) => total + countOptionalProperties(child), 0);
    };

    expect(countOptionalProperties(IMPORT_ANALYSIS_OUTPUT_SCHEMA)).toBeLessThanOrEqual(24);
  });

  it('decodes required nullable provider records without materializing null facts', () => {
    const schema = IMPORT_ANALYSIS_OUTPUT_SCHEMA as any;
    const itemSchema = schema.properties.groups.items.properties.items.items;
    const nullableRecord = (recordSchema: any) => Object.fromEntries(Object.keys(recordSchema.properties).map(key => [key, null]));
    const providerItem = {
      ...item,
      validation: nullableRecord(itemSchema.properties.validation),
      confidence: nullableRecord(itemSchema.properties.confidence),
      uncertainty: nullableRecord(itemSchema.properties.uncertainty),
      proposedCompassEntryId: null,
      proposedProductId: null,
      chineseName: null,
      type: null,
      form: null,
      year: null,
      originCountry: null,
      originRegion: null,
      classification: null,
      description: null,
      inventoryPurpose: null,
    };
    const decoded = decodeImportAnalysisProposal({
      overview: 'one', language: 'en', annotations: [],
      groups: [{
        key: 'v', proposedVendorName: null, proposedVendorCustomerId: null,
        vendorConfidence: null, uncertainty: { vendor: null }, items: [providerItem],
      }],
    });

    expect(decoded.groups[0].items[0]).toMatchObject({ confidence: {}, validation: {}, uncertainty: {} });
    expect(decoded.groups[0].uncertainty).toEqual({});
  });

  it('rejects provider batches above the D1-safe item cap', () => {
    const items = Array.from({ length: 101 }, (_, index) => ({ ...item, sourceItemId: `item-${index}` }));
    expect(() => decodeImportAnalysisProposal({
      overview: 'too many', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items }],
    })).toThrow(/analysis_too_many_items/);
  });

  it('decodes bounded provider-classified non-item record annotations', () => {
    const value = proposal();
    const decoded = decodeImportAnalysisProposal({
      ...value,
      annotations: [{ sourceId: 'source-1', kind: 'fee', text: 'Shipping: CNY 50', evidenceRef: 'source-1:19-35' }],
    });

    expect(decoded.annotations).toEqual([{ sourceId: 'source-1', kind: 'fee', text: 'Shipping: CNY 50', evidenceRef: 'source-1:19-35' }]);
    expect(() => decodeImportAnalysisProposal({
      ...value,
      annotations: [{ sourceId: 'source-1', kind: 'tea', text: 'Not an annotation' }],
    })).toThrow(/annotation/i);
  });

  it('normalizes per-pack tea math while preserving Chinese names', () => {
    expect(normalizeImportProposal(proposal()).groups[0].items[0]).toMatchObject({
      originalName: '云南古树生普', totalQuantityGrams: 1000, totalUnits: null,
      lineCost: 760, unitCost: 0.76, blockingFields: [],
    });
  });

  it('normalizes line totals and exact kg-to-gram conversion', () => {
    expect(normalizeImportProposal(proposal({ packWeight: 1.25, weightUnit: 'kg', packCount: 2, priceAmount: 900, priceBasis: 'line_total' })).groups[0].items[0]).toMatchObject({
      totalQuantityGrams: 2500, lineCost: 900, unitCost: 0.36,
    });
  });

  it('normalizes count-based teaware without inventing gram quantities', () => {
    const normalized = normalizeImportProposal(proposal({ category: 'teaware', packWeight: 1, weightUnit: 'count', packCount: 3, priceAmount: 40, currency: 'USD' })).groups[0].items[0];
    expect(normalized).toMatchObject({ totalQuantityGrams: null, totalUnits: 3, lineCost: 120, unitCost: 40 });
  });

  it('keeps currencies authoritative and separate across groups', () => {
    const value = decodeImportAnalysisProposal({ overview: 'two', language: 'mixed', groups: [
      { key: 'a', proposedVendorName: 'A', items: [item] },
      { key: 'b', proposedVendorName: 'B', items: [{ ...item, sourceItemId: 'item-2', priceAmount: 12, currency: 'USD' }] },
    ] });
    expect(normalizeImportProposal(value).groups.flatMap(group => group.items).map(entry => entry.currency)).toEqual(['CNY', 'USD']);
  });

  it('blocks ambiguous or incomplete physical quantity and cost fields', () => {
    const normalized = normalizeImportProposal(proposal({ packCount: null, priceBasis: 'unknown', currency: null })).groups[0].items[0];
    expect(normalized.lineCost).toBeNull();
    expect(normalized.blockingFields).toEqual(expect.arrayContaining(['packCount', 'priceBasis', 'currency']));
  });

  it.each([
    { packWeight: -1 }, { packWeight: Number.NaN }, { packCount: -1 },
    { priceAmount: -1 }, { priceAmount: Number.POSITIVE_INFINITY },
  ])('rejects invalid numeric proposal fields: %j', override => {
    expect(() => decodeImportAnalysisProposal(proposal(override))).toThrow(/invalid/i);
  });

  it('rejects malformed enum and nested records', () => {
    expect(() => decodeImportAnalysisProposal(proposal({ weightUnit: 'jin' as never }))).toThrow(/weightUnit/);
    expect(() => decodeImportAnalysisProposal(proposal({ uncertainty: [] as never }))).toThrow(/uncertainty/);
  });

  it.each([
    { year: '2020' }, { year: 10000 }, { form: 42 }, { classification: 'x'.repeat(501) },
    { description: 'x'.repeat(5001) }, { originRegion: [] },
  ])('strictly validates optional metadata: %j', override => {
    expect(() => decodeImportAnalysisProposal(proposal(override as never))).toThrow(/Invalid/);
  });

  it('rejects unknown fields and empty proposals', () => {
    expect(() => decodeImportAnalysisProposal({ ...proposal(), injected: true })).toThrow(/Unknown proposal field/);
    expect(() => decodeImportAnalysisProposal({ overview: 'none', language: 'en', groups: [] })).toThrow(/groups/);
    expect(() => decodeImportAnalysisProposal(proposal({ injected: true } as never))).toThrow(/Unknown item field/);
  });

  it('rejects duplicate group keys and source item identifiers', () => {
    expect(() => decodeImportAnalysisProposal({ ...proposal(), groups: [proposal().groups[0], { ...proposal().groups[0], items: [{ ...item, sourceItemId: 'item-2' }] }] })).toThrow(/duplicate group key/i);
    expect(() => decodeImportAnalysisProposal({ ...proposal(), groups: [proposal().groups[0], { ...proposal().groups[0], key: 'other' }] })).toThrow(/duplicate sourceItemId/i);
  });

  it('blocks Han originals without a separate English translation', () => {
    const missing = normalizeImportProposal(proposal({ englishName: null })).groups[0].items[0];
    const stillHan = normalizeImportProposal(proposal({ englishName: '云南古树生普' })).groups[0].items[0];
    expect(missing.blockingFields).toContain('englishName');
    expect(stillHan.blockingFields).toContain('englishName');
  });

  it('blocks low-confidence and explicitly uncertain material fields', () => {
    const normalized = normalizeImportProposal(proposal({
      confidence: { priceAmount: 0.6, currency: 0.95, acquired: 0.79 },
      uncertainty: { packCount: 'could be two or three' },
    })).groups[0].items[0];
    expect(normalized.blockingFields).toEqual(expect.arrayContaining(['priceAmount', 'packCount', 'acquired']));
  });

  it.each([
    ['usd', 'USD', false],
    ['cNy', 'CNY', false],
    ['bnd', 'BND', false],
    ['PKR', 'PKR', false],
    ['¥', null, true],
    ['ZZZ', null, true],
  ])('canonicalizes supported currency %s to %s and blocked=%s', (currency, expected, blocked) => {
    const normalized = normalizeImportProposal(proposal({ currency })).groups[0].items[0];
    expect(normalized.currency).toBe(expected);
    expect(normalized.blockingFields.includes('currency')).toBe(blocked);
  });

  it('preserves authoritative decimal strings through exact arithmetic', () => {
    const normalized = normalizeImportProposal(proposal({ priceAmount: '0.1', packCount: 3, packWeight: 3 })).groups[0].items[0];
    expect(normalized).toMatchObject({ priceAmountExact: '0.1', lineCostExact: '0.3', unitCostExact: '0.033333333333333333' });
    expect(normalized.lineCost).toBe(0.3);
  });

  it('never converts an unrepresentable authoritative decimal into a numeric money field', () => {
    const normalized = normalizeImportProposal(proposal({ priceAmount: '999999999999999.99', priceBasis: 'line_total' })).groups[0].items[0];
    expect(normalized).toMatchObject({ priceAmountExact: '999999999999999.99', lineCostExact: '999999999999999.99', priceAmount: null, lineCost: null });
  });

  it('rejects non-integer legacy numeric prices because their source decimal lexeme is unavailable', () => {
    expect(() => decodeImportAnalysisProposal(proposal({ priceAmount: 0.1 }))).toThrow(/decimal string/i);
  });

  it('blocks unresolved acquisition and duplicate identity decisions', () => {
    const normalized = normalizeImportProposal(proposal({ acquired: null, duplicateResolution: 'unresolved' })).groups[0].items[0];
    expect(normalized.blockingFields).toEqual(expect.arrayContaining(['acquired', 'duplicateResolution']));
  });

  it('builds a bounded instruction prompt containing evidence and account-scoped candidates', () => {
    const prompt = buildImportAnalysisPrompt(
      { sources: [{ id: 'source-1', kind: 'paste', text: '500g ×2 ¥380' }] },
      { vendors: [{ id: 'vendor-a', name: 'Chen Family Tea', aliases: ['Chen'] }], journeys: [{ id: 'journey-a', name: 'Yunnan 2026' }] },
    );
    expect(prompt).toContain('500g ×2 ¥380');
    expect(prompt).toContain('vendor-a');
    expect(prompt).toContain('Never infer priceBasis');
    expect(prompt).toMatch(/priceAmount.*decimal string/i);
    expect(prompt).toContain('call the submitted material a record or records, never evidence');
  });

  it('recognizes supplier, purchased tea lines, totals, and acquired grams in a pasted vendor record', () => {
    const evidence = { sources: [{
      id: 'source-huang', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n陈年旧熟普400元/500克 x2=800元\n北越旧熟普280元/500克 x4=1120元\n共计：2300元X2=4600元',
    }] };

    const hints = buildImportRecordHints(evidence);

    expect(hints).toMatchObject({
      complete: true,
      suppliers: [{ name: 'Huang Wei' }],
      items: [
        { originalName: '陈年六堡茶', packWeight: 500, weightUnit: 'g', packCount: 1, priceAmount: '380', currency: 'CNY', priceBasis: 'per_pack', lineTotal: '380', totalQuantityGrams: 500 },
        { originalName: '陈年旧熟普', packWeight: 500, weightUnit: 'g', packCount: 2, priceAmount: '400', currency: 'CNY', priceBasis: 'per_pack', lineTotal: '800', totalQuantityGrams: 1000 },
        { originalName: '北越旧熟普', packWeight: 500, weightUnit: 'g', packCount: 4, priceAmount: '280', currency: 'CNY', priceBasis: 'per_pack', lineTotal: '1120', totalQuantityGrams: 2000 },
      ],
      ignoredSummaries: [{ text: '共计：2300元X2=4600元' }],
    });
    expect(buildImportAnalysisPrompt(evidence, { vendors: [], journeys: [] })).toContain('RECORD_HINTS=');
  });

  it.each([
    {
      label: 'Chinese slash and multiplication symbols with an equals total',
      line: '陈年六堡茶 380元／500克 × 2 = 760元',
      expected: { originalName: '陈年六堡茶', packWeight: 500, weightUnit: 'g', packCount: 2, priceAmount: '380', priceBasis: 'per_pack', lineTotal: '760', totalQuantityGrams: 1000 },
    },
    {
      label: 'Western at-sign price per pack without an equals total',
      line: 'Aged Liu Bao Tea | 500g x 2 @ CNY 380',
      expected: { originalName: 'Aged Liu Bao Tea', packWeight: 500, weightUnit: 'g', packCount: 2, priceAmount: '380', priceBasis: 'per_pack', lineTotal: '760', totalQuantityGrams: 1000 },
    },
    {
      label: 'count-first Western equation and RMB each',
      line: 'Aged Ripe Pu-erh Tea, 2 * 0.5 kg, 400.25 RMB each',
      expected: { originalName: 'Aged Ripe Pu-erh Tea', packWeight: 0.5, weightUnit: 'kg', packCount: 2, priceAmount: '400.25', priceBasis: 'per_pack', lineTotal: '800.5', totalQuantityGrams: 1000 },
    },
    {
      label: 'explicit total weight and line price',
      line: 'Northern Vietnam Ripe Pu-erh Tea    1.25 kg total    CNY 1120.50 total',
      expected: { originalName: 'Northern Vietnam Ripe Pu-erh Tea', packWeight: 1.25, weightUnit: 'kg', packCount: 1, priceAmount: '1120.5', priceBasis: 'line_total', lineTotal: '1120.5', totalQuantityGrams: 1250 },
    },
    {
      label: 'tab-separated columns and explicit line price',
      line: 'White Tea Cake\t357 g\t3\tCNY 900 line total',
      expected: { originalName: 'White Tea Cake', packWeight: 357, weightUnit: 'g', packCount: 3, priceAmount: '900', priceBasis: 'line_total', lineTotal: '900', totalQuantityGrams: 1071 },
    },
  ])('locks numeric facts for $label', ({ line, expected }) => {
    const hints = buildImportRecordHints({ sources: [{ id: 'source-variants', kind: 'paste', text: `Supplier Name\n${line}` }] });
    expect(hints.complete).toBe(true);
    expect(hints.items).toHaveLength(1);
    expect(hints.items[0]).toMatchObject(expected);
    expect(hints.items[0].arithmeticMatches).toBe(true);
  });

  it('classifies headings, notes, fees, subtotals, and totals as annotations, never items', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-annotations', kind: 'paste',
      text: [
        'Huang Wei',
        'Spring order',
        '陈年六堡茶 380元/500克 x1=380元',
        'Note: bamboo wrapping damaged',
        'Shipping: CNY 50',
        'Subtotal: CNY 380',
        'Total: CNY 430',
      ].join('\n'),
    }] });

    expect(hints.complete).toBe(true);
    expect(hints.items).toHaveLength(1);
    expect(hints.annotations.map(annotation => annotation.kind)).toEqual(['heading', 'note', 'fee', 'subtotal', 'total']);
    expect(hints.annotations.map(annotation => annotation.text)).not.toContain('陈年六堡茶 380元/500克 x1=380元');
  });

  it('keeps multiple supplier sections separate in deterministic fallback output', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-multi', kind: 'paste',
      text: [
        'Supplier: Huang Wei',
        '陈年六堡茶 380元/500克 x1=380元',
        'Supplier: Chen Family Tea',
        'White Tea Cake | 357g x 2 @ CNY 120',
      ].join('\n'),
    }] });
    const fallback = normalizeImportProposal(buildImportRecordFallbackProposal(hints));

    expect(hints.complete).toBe(true);
    expect(fallback.groups.map(group => ({ vendor: group.proposedVendorName, names: group.items.map(entry => entry.originalName) }))).toEqual([
      { vendor: 'Huang Wei', names: ['陈年六堡茶'] },
      { vendor: 'Chen Family Tea', names: ['White Tea Cake'] },
    ]);
  });

  it('returns exactly the three Huang Wei teas with deterministic names, grams, and CNY line costs', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-huang-exact', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n陈年旧熟普400元/500克 x2=800元\n北越旧熟普280元/500克 x4=1120元\n共计：2300元X2=4600元',
    }] });
    const records = normalizeImportProposal(buildImportRecordFallbackProposal(hints)).groups.flatMap(group => group.items);

    expect(records.map(({ englishName, totalQuantityGrams, lineCostExact }) => ({ englishName, totalQuantityGrams, lineCostExact }))).toEqual([
      { englishName: 'Aged Liu Bao Tea', totalQuantityGrams: 500, lineCostExact: '380' },
      { englishName: 'Aged Ripe Pu-erh Tea', totalQuantityGrams: 1000, lineCostExact: '800' },
      { englishName: 'Aged Northern Vietnam Ripe Pu-erh Tea', totalQuantityGrams: 2000, lineCostExact: '1120' },
    ]);
    expect(records.reduce((sum, entry) => sum + (entry.totalQuantityGrams ?? 0), 0)).toBe(3500);
    expect(records.reduce((sum, entry) => sum + Number(entry.lineCostExact), 0)).toBe(2300);
  });

  it('publishes explicit provider confidence and validation keys', () => {
    const itemSchema = (IMPORT_ANALYSIS_OUTPUT_SCHEMA.properties.groups.items.properties.items.items as { properties: Record<string, unknown> });
    expect(itemSchema.properties.confidence).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({
        translation: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        originalName: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        priceBasis: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      }),
      additionalProperties: false,
    });
    expect(itemSchema.properties.validation).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({ translation: { anyOf: [
        { type: 'string', enum: expect.arrayContaining(['not_present', 'uncertain', 'validated']) },
        { type: 'null' },
      ] } }),
      additionalProperties: false,
    });
    expect(() => decodeImportAnalysisProposal(proposal({ confidence: { inventedField: 0.9 } }))).toThrow(/confidence\.inventedField/);
  });

  it('blocks terminology-inconsistent translations while accepting a validated glossary translation', () => {
    const inconsistent = normalizeImportProposal(proposal({
      originalName: '陈年六堡茶', englishName: 'Aged White Tea', confidence: { translation: 0.99 },
    })).groups[0].items[0];
    const consistent = normalizeImportProposal(proposal({
      originalName: '陈年六堡茶', englishName: 'Aged Liu Bao Tea', confidence: { translation: 0.99 },
    })).groups[0].items[0];

    expect(inconsistent.blockingFields).toContain('englishName');
    expect(inconsistent.validation).toMatchObject({ translation: 'uncertain' });
    expect(consistent.blockingFields).not.toContain('englishName');
    expect(consistent.validation).toMatchObject({ translation: 'validated' });
  });

  it('reuses the canonical English identity for an exact original-name match', () => {
    const evidence = { sources: [{ id: 'source-canonical', kind: 'paste', text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元' }] };
    const hints = buildImportRecordHints(evidence);
    const provider = proposal({ originalName: '陈年六堡茶', englishName: 'Old Liubao', sourceItemId: hints.items[0].sourceItemId });
    const applied = applyImportRecordHints(provider, hints, {
      vendors: [], journeys: [], identities: [{ id: 'identity-liubao', name: 'Aged Liu Bao Tea', chineseName: '陈年六堡茶', category: 'tea', productId: 'product-liubao' }],
    });
    const normalized = normalizeImportProposal(applied).groups[0].items[0];

    expect(normalized).toMatchObject({
      englishName: 'Aged Liu Bao Tea', duplicateResolution: 'matched', proposedCompassEntryId: 'identity-liubao', proposedProductId: 'product-liubao',
      validation: { translation: 'canonical_match' },
    });
    expect(normalized.blockingFields).not.toContain('englishName');
    expect(normalized.blockingFields).not.toContain('duplicateResolution');
  });

  it('records absent optional metadata as not_present without blocking the item', () => {
    const normalized = normalizeImportProposal(proposal({
      validation: { year: 'not_present', originRegion: 'not_present', translation: 'validated' },
    } as never)).groups[0].items[0];
    expect(normalized.validation).toMatchObject({ year: 'not_present', originRegion: 'not_present' });
    expect(normalized.blockingFields).not.toEqual(expect.arrayContaining(['year', 'originRegion']));
  });

  it('retains explicit facts but keeps an unlabeled item price basis unknown and the record incomplete', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-ambiguous-price', kind: 'paste', text: 'Huang Wei\nMystery Tea | 500g x 2 | CNY 380',
    }] });

    expect(hints.complete).toBe(false);
    expect(hints.items).toHaveLength(1);
    expect(hints.items[0]).toMatchObject({
      originalName: 'Mystery Tea', packWeight: 500, packCount: 2, priceAmount: '380',
      currency: 'CNY', priceBasis: 'unknown', lineTotal: null, arithmeticMatches: false,
    });
  });

  it('blocks explicit uncertain validation for material identity and translation', () => {
    const normalized = normalizeImportProposal(proposal({
      originalName: '陈年六堡茶', englishName: 'Aged Liu Bao Tea',
      confidence: { translation: 0.99, identity: 0.99 },
      validation: { translation: 'uncertain', identity: 'uncertain' },
    } as never)).groups[0].items[0];

    expect(normalized.blockingFields).toEqual(expect.arrayContaining(['englishName', 'identity']));
    expect(normalized.validation).toMatchObject({ translation: 'uncertain', identity: 'uncertain' });
  });

  it('automatically marks every absent optional enrichment field not_present', () => {
    const normalized = normalizeImportProposal(proposal({
      chineseName: null, type: null, form: null, year: null, originCountry: null,
      originRegion: null, classification: null, description: null,
    } as never)).groups[0].items[0];

    expect(normalized.validation).toMatchObject({
      type: 'not_present', form: 'not_present', year: 'not_present', originCountry: 'not_present',
      originRegion: 'not_present', classification: 'not_present', description: 'not_present',
    });
  });

  it.each([
    { originalName: 'Green Tea', englishName: '绿茶', language: 'en' },
    { originalName: 'ชาอู่หลง', englishName: 'ชาอู่หลง', language: 'th' },
    { originalName: 'Thé Blanc', englishName: 'Thé Blanc', language: 'fr' },
  ])('blocks invalid English identity pair %#', ({ originalName, englishName, language }) => {
    const value = proposal({ originalName, englishName, confidence: { translation: 1 } });
    value.language = language;
    expect(normalizeImportProposal(value).groups[0].items[0].blockingFields).toContain('englishName');
  });

  it('matches a canonical identity using the provider translated Chinese name', () => {
    const evidence = { sources: [{ id: 'source-translated-chinese', kind: 'paste', text: 'Huang Wei\nOld Liubao | 500g x 1 @ CNY 380' }] };
    const hints = buildImportRecordHints(evidence);
    const provider = proposal({
      sourceItemId: hints.items[0].sourceItemId, originalName: 'Old Liubao', chineseName: '陈年六堡茶', englishName: 'Old Liubao',
    } as never);
    const normalized = normalizeImportProposal(applyImportRecordHints(provider, hints, {
      vendors: [], journeys: [], identities: [{ id: 'identity-liubao', name: 'Aged Liu Bao Tea', chineseName: '陈年六堡茶', category: 'tea' }],
    })).groups[0].items[0];

    expect(normalized).toMatchObject({
      englishName: 'Aged Liu Bao Tea', proposedCompassEntryId: 'identity-liubao', duplicateResolution: 'matched',
      validation: { translation: 'canonical_match' },
    });
  });

  it('recognizes multiple unlabelled supplier sections by their following purchase lines', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-unlabelled-suppliers', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\nChen Family Tea\nWhite Tea Cake | 357g x 2 @ CNY 120',
    }] });
    const fallback = buildImportRecordFallbackProposal(hints);

    expect(hints.complete).toBe(true);
    expect(fallback.groups.map(group => ({ vendor: group.proposedVendorName, items: group.items.map(entry => entry.originalName) }))).toEqual([
      { vendor: 'Huang Wei', items: ['陈年六堡茶'] },
      { vendor: 'Chen Family Tea', items: ['White Tea Cake'] },
    ]);
  });

  it('classifies Chinese fee and note prefixes despite Unicode word-boundary behavior', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-chinese-annotations', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n运费：50元\n备注：竹篮破损',
    }] });

    expect(hints.complete).toBe(true);
    expect(hints.annotations.map(annotation => ({ kind: annotation.kind, text: annotation.text }))).toEqual([
      { kind: 'fee', text: '运费：50元' },
      { kind: 'note', text: '备注：竹篮破损' },
    ]);
  });

  it('blocks translations that add a contradictory tea family term', () => {
    const normalized = normalizeImportProposal(proposal({
      originalName: '陈年六堡茶', englishName: 'Aged Liu Bao White Tea', confidence: { translation: 0.99 },
    })).groups[0].items[0];

    expect(normalized.blockingFields).toContain('englishName');
    expect(normalized.validation).toMatchObject({ translation: 'uncertain' });
  });

  it('uses subtotal and total amounts as arithmetic checks without applying their multiplier to item quantities', () => {
    const huang = buildImportRecordHints({ sources: [{
      id: 'source-total-check', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n陈年旧熟普400元/500克 x2=800元\n北越旧熟普280元/500克 x4=1120元\n共计：2300元X2=4600元',
    }] });
    const mismatch = buildImportRecordHints({ sources: [{
      id: 'source-subtotal-mismatch', kind: 'paste', text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n小计：400元',
    }] });

    expect(huang.complete).toBe(true);
    expect(huang.items.map(entry => entry.packCount)).toEqual([1, 2, 4]);
    expect(huang.annotations).toContainEqual(expect.objectContaining({ kind: 'total', amountExact: '2300', currency: 'CNY', arithmeticMatches: true }));
    expect(mismatch.complete).toBe(false);
    expect(mismatch.annotations).toContainEqual(expect.objectContaining({ kind: 'subtotal', amountExact: '400', currency: 'CNY', arithmeticMatches: false }));
  });

  it.each([
    { originalName: 'ชาอู่หลง', englishName: 'Oolong Tea', language: 'th', confidence: {} },
    { originalName: 'Thé Blanc', englishName: 'White Tea', language: 'fr', confidence: { translation: 0.79 } },
    { originalName: 'Thé Blanc', englishName: 'White Tea', language: 'mixed', confidence: {} },
  ])('blocks missing or low translation confidence for non-English originals: %#', ({ originalName, englishName, language, confidence }) => {
    const value = proposal({ originalName, englishName, confidence });
    value.language = language;
    const normalized = normalizeImportProposal(value).groups[0].items[0];

    expect(normalized.blockingFields).toContain('englishName');
    expect(normalized.validation).toMatchObject({ translation: 'uncertain' });
  });

  it('blocks an explicitly uncertain vendor validation state', () => {
    const normalized = normalizeImportProposal(proposal({
      validation: { vendor: 'uncertain', translation: 'validated' },
    } as never)).groups[0].items[0];

    expect(normalized.blockingFields).toContain('vendor');
  });

  it('marks equal subtotal and total amounts incomplete when their currency differs from the item currency', () => {
    const hints = buildImportRecordHints({ sources: [{
      id: 'source-currency-mismatch', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\nSubtotal: USD 380\nTotal: USD 380',
    }] });

    expect(hints.complete).toBe(false);
    expect(hints.annotations.filter(annotation => annotation.kind === 'subtotal' || annotation.kind === 'total')).toEqual([
      expect.objectContaining({ kind: 'subtotal', amountExact: '380', currency: 'USD', arithmeticMatches: false }),
      expect.objectContaining({ kind: 'total', amountExact: '380', currency: 'USD', arithmeticMatches: false }),
    ]);
  });

  it.each([
    { symbol: '¥', currency: '¥' },
    { symbol: '￥', currency: '¥' },
    { symbol: '$', currency: '$' },
  ])('keeps bare currency symbol $symbol unresolved and the record incomplete', ({ symbol, currency }) => {
    const hints = buildImportRecordHints({ sources: [{
      id: `source-symbol-${symbol}`, kind: 'paste', text: `Supplier: Example Vendor\nMystery Tea | 500g x 1 @ ${symbol}380`,
    }] });

    expect(hints.complete).toBe(false);
    expect(hints.items).toHaveLength(1);
    expect(hints.items[0]).toMatchObject({ currency, arithmeticMatches: true });
  });

  it.each([
    ['originalName', 'identity'],
    ['category', 'identity'],
    ['duplicateResolution', 'duplicateResolution'],
  ])('blocks low confidence for material field %s', (field, blocker) => {
    const normalized = normalizeImportProposal(proposal({
      confidence: { [field]: 0.79 },
    })).groups[0].items[0];

    expect(normalized.blockingFields).toContain(blocker);
  });

  it('publishes and enforces known keyed string uncertainty explanations', () => {
    const groupSchema = IMPORT_ANALYSIS_OUTPUT_SCHEMA.properties.groups.items;
    const itemSchema = groupSchema.properties.items.items;
    expect(groupSchema.properties.uncertainty).toMatchObject({
      type: 'object', properties: { vendor: { anyOf: [{ type: 'string' }, { type: 'null' }] } }, additionalProperties: false,
    });
    expect(itemSchema.properties.uncertainty).toMatchObject({
      type: 'object', properties: expect.objectContaining({
        translation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        packCount: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      }), additionalProperties: false,
    });
    expect(() => decodeImportAnalysisProposal(proposal({ uncertainty: { inventedField: 'unsupported' } }))).toThrow(/uncertainty\.inventedField/);
    const badGroup = proposal();
    badGroup.groups[0].uncertainty = { inventedField: 'unsupported' };
    expect(() => decodeImportAnalysisProposal(badGroup)).toThrow(/group\.uncertainty\.inventedField/);
  });

  it('keeps inferred supplier-like headings as uncertain suggestions while explicit suppliers stay trusted', () => {
    const inferredHints = buildImportRecordHints({ sources: [{
      id: 'source-heading-vendor', kind: 'paste', text: 'Premium Collection\nWhite Tea Cake | 357g x 1 @ CNY 120',
    }] });
    const inferred = normalizeImportProposal(buildImportRecordFallbackProposal(inferredHints)).groups[0];
    const explicitHints = buildImportRecordHints({ sources: [{
      id: 'source-explicit-vendor', kind: 'paste', text: 'Supplier: Chen Family Tea\nWhite Tea Cake | 357g x 1 @ CNY 120',
    }] });
    const explicit = normalizeImportProposal(buildImportRecordFallbackProposal(explicitHints)).groups[0];

    expect(inferred).toMatchObject({ proposedVendorName: 'Premium Collection', vendorConfidence: null, uncertainty: { vendor: expect.any(String) } });
    expect(inferred.items[0].blockingFields).toContain('vendor');
    expect(explicit).toMatchObject({ proposedVendorName: 'Chen Family Tea', vendorConfidence: 1, uncertainty: {} });
    expect(explicit.items[0].blockingFields).not.toContain('vendor');
    expect(buildImportAnalysisPrompt(
      { sources: [{ id: 'source-heading-vendor', kind: 'paste', text: 'Premium Collection\nWhite Tea Cake | 357g x 1 @ CNY 120' }] },
      { vendors: [], journeys: [] },
    )).toContain('Inferred supplier names are suggestions only');
  });

  it('promotes an inferred Huang first-line supplier only after provider confirmation', () => {
    const evidence = { sources: [{ id: 'source-huang-provider', kind: 'paste', text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元' }] };
    const hints = buildImportRecordHints(evidence);
    const provider = proposal({ originalName: '陈年六堡茶', englishName: 'Aged Liu Bao Tea', sourceItemId: hints.items[0].sourceItemId });
    provider.groups[0].proposedVendorName = 'Huang Wei';
    const normalized = normalizeImportProposal(applyImportRecordHints(provider, hints)).groups[0];

    expect(normalized).toMatchObject({ proposedVendorName: 'Huang Wei', vendorConfidence: 1, uncertainty: {} });
    expect(normalized.items[0].blockingFields).not.toContain('vendor');
  });

  it('uses deterministic record facts while retaining the model translations', () => {
    const evidence = { sources: [{
      id: 'source-huang', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n陈年旧熟普400元/500克 x2=800元\n北越旧熟普280元/500克 x4=1120元\n共计：2300元X2=4600元',
    }] };
    const hints = buildImportRecordHints(evidence);
    const proposed = (sourceItemId: string, originalName: string, englishName: string) => ({
      ...item, sourceItemId, originalName, englishName, evidenceRefs: ['source-huang'],
    });
    const providerProposal: ImportAnalysisProposal = {
      overview: 'Imported lines', language: 'zh', groups: [{ key: 'unknown', proposedVendorName: null, items: [
        proposed('supplier', 'Huang Wei', 'Huang Wei'),
        proposed('tea-1', '陈年六堡茶', 'Aged Liubao Tea'),
        proposed('tea-2', '陈年旧熟普', 'Aged Ripe Pu’er'),
        proposed('tea-3', '北越旧熟普', 'Northern Vietnam Aged Ripe Pu’er'),
        proposed('total', '共计', 'Total'),
      ] }],
    };

    const normalized = normalizeImportProposal(applyImportRecordHints(providerProposal, hints));

    expect(normalized.groups).toHaveLength(1);
    expect(normalized.groups[0].proposedVendorName).toBe('Huang Wei');
    expect(normalized.groups[0].items.map(entry => ({
      originalName: entry.originalName,
      englishName: entry.englishName,
      totalQuantityGrams: entry.totalQuantityGrams,
      lineCost: entry.lineCost,
    }))).toEqual([
      { originalName: '陈年六堡茶', englishName: 'Aged Liubao Tea', totalQuantityGrams: 500, lineCost: 380 },
      { originalName: '陈年旧熟普', englishName: 'Aged Ripe Pu’er', totalQuantityGrams: 1000, lineCost: 800 },
      { originalName: '北越旧熟普', englishName: 'Northern Vietnam Aged Ripe Pu’er', totalQuantityGrams: 2000, lineCost: 1120 },
    ]);
  });

  it('keeps complete record facts reviewable when every model provider is unavailable', () => {
    const evidence = { sources: [{
      id: 'source-huang', kind: 'paste',
      text: 'Huang Wei\n陈年六堡茶380元/500克 x1=380元\n陈年旧熟普400元/500克 x2=800元\n北越旧熟普280元/500克 x4=1120元\n共计：2300元X2=4600元',
    }] };

    const normalized = normalizeImportProposal(buildImportRecordFallbackProposal(buildImportRecordHints(evidence)));

    expect(normalized).toMatchObject({
      overview: 'Recovered 3 purchased items from the record; translation and identity need review.',
      groups: [{
        proposedVendorName: 'Huang Wei',
        items: [
          { originalName: '陈年六堡茶', englishName: 'Aged Liu Bao Tea', totalQuantityGrams: 500, lineCost: 380 },
          { originalName: '陈年旧熟普', englishName: 'Aged Ripe Pu-erh Tea', totalQuantityGrams: 1000, lineCost: 800 },
          { originalName: '北越旧熟普', englishName: 'Aged Northern Vietnam Ripe Pu-erh Tea', totalQuantityGrams: 2000, lineCost: 1120 },
        ],
      }],
    });
    expect(normalized.groups[0].items[0].blockingFields).toContain('duplicateResolution');
    expect(normalized.groups[0].items[0].blockingFields).not.toContain('englishName');
  });

  it('bounds provider candidates and strips contact aliases', () => {
    const prompt = buildImportAnalysisPrompt(
      { sources: [{ id: 'source-1', kind: 'paste', text: 'Taiwan Tea' }] },
      {
        vendors: Array.from({ length: 80 }, (_, index) => ({ id: `vendor-${index}`, name: `Vendor ${index}`, aliases: [`person${index}@example.com`, '+62 812 000 000'] })),
        journeys: Array.from({ length: 80 }, (_, index) => ({ id: `journey-${index}`, name: `Journey ${index}` })),
        identities: Array.from({ length: 80 }, (_, index) => ({ id: `identity-${index}`, name: `Tea ${index}`, chineseName: null, category: 'tea' })),
      },
    );
    expect(prompt).not.toMatch(/@example\.com|\+62 812|whatsapp/i);
    expect(prompt).toContain('vendor-49');
    expect(prompt).not.toContain('vendor-50');
    expect(prompt).not.toContain('journey-50');
    expect(prompt).not.toContain('identity-50');
  });
});
