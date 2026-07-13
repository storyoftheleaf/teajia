import { describe, expect, it } from 'vitest';
import {
  buildImportAnalysisPrompt,
  decodeImportAnalysisProposal,
  normalizeImportProposal,
  type ImportAnalysisProposal,
} from '../src/curateImportAnalysis';

const item = {
  sourceItemId: 'item-1', category: 'tea' as const, originalName: '云南古树生普',
  englishName: 'Yunnan Ancient Tree Raw Pu’er', packWeight: 500,
  weightUnit: 'g' as const, packCount: 2, priceAmount: 380, currency: 'CNY',
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

  it('rejects unknown fields and empty proposals', () => {
    expect(() => decodeImportAnalysisProposal({ ...proposal(), injected: true })).toThrow(/Unknown proposal field/);
    expect(() => decodeImportAnalysisProposal({ overview: 'none', language: 'en', groups: [] })).toThrow(/groups/);
    expect(() => decodeImportAnalysisProposal(proposal({ injected: true } as never))).toThrow(/Unknown item field/);
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
  });
});
