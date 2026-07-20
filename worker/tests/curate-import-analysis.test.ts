import { describe, expect, it } from 'vitest';
import {
  applyImportRecordHints,
  buildImportAnalysisPrompt,
  buildImportRecordHints,
  decodeImportAnalysisProposal,
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
