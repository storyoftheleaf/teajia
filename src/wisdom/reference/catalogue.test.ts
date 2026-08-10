import { describe, expect, it } from 'vitest';
import type { PublicProduct } from '../../types';
import type {
  PublicReferenceEntry,
  PublicReferencePreview,
  PublicReferenceStatement,
} from '../receiving/previewImporter';
import { buildTeaReferenceCatalogue } from './catalogue';

const statement = (id: string): PublicReferenceStatement => ({
  id,
  label: 'Identity',
  text: `Public reference note for ${id}.`,
  excerpt: `Public excerpt for ${id}.`,
  citation: { label: 'Tea Institute, Reference (2026)', url: `https://example.com/${id}` },
});

const entry = (
  id: string,
  label: string,
  entityKind: string,
  statements: PublicReferenceStatement[] = [statement(`${id}-fact`)],
): PublicReferenceEntry => ({
  id,
  label,
  entityKind,
  kindLabel: entityKind.replace(/_/g, ' '),
  statements,
  reportUrl: `mailto:hello@teajia.com?subject=${id}`,
});

const referenceEntries = [
  entry('resolution-puer', 'Pu’er', 'tea_family'),
  entry('resolution-sheng', 'Sheng', 'tea_style'),
  entry('resolution-shou', 'Shou', 'tea_style'),
  entry('resolution-yunnan', 'Yunnan', 'major_region'),
  entry('resolution-yiwu', 'Yiwu', 'tea_area'),
  entry('resolution-bulang', 'Bulang Mountain', 'mountain'),
  entry('resolution-laomane', 'Lao Man’e', 'village'),
  entry('resolution-menghai', 'Menghai', 'locality'),
  entry('resolution-jingmai', 'Jingmai', 'mountain'),
  entry('resolution-vendor-valley', 'Vendor Valley', 'tea_area'),
  entry('resolution-taxonomy', 'Raw tea', 'taxonomy_term'),
  entry('resolution-glossary', 'Cake', 'glossary_term'),
] as const;

function preview(entries: readonly PublicReferenceEntry[] = referenceEntries): PublicReferencePreview {
  return {
    title: 'Tea reference',
    deck: 'Cited public tea knowledge.',
    sourceCount: 2,
    entryCount: entries.length,
    sections: [
      { id: 'reference', label: 'Reference', description: 'Public entries.', entries: [...entries] },
    ],
    geographicScale: [],
    sources: [
      {
        sourceId: 'source-z',
        publisher: 'Zed Institute',
        publisherRoleLabel: 'Institute',
        title: 'Zed source',
        author: 'Zed',
        publishedDate: '2026-01-01',
        url: 'https://example.com/z',
      },
      {
        sourceId: 'source-a',
        publisher: 'Alpha Institute',
        publisherRoleLabel: 'Institute',
        title: 'Alpha source',
        author: 'Alpha',
        publishedDate: '2025-01-01',
        url: 'https://example.com/a',
      },
    ],
    reportUrl: 'mailto:hello@teajia.com?subject=Tea%20Reference',
  };
}

function product(overrides: Partial<PublicProduct> & Pick<PublicProduct, 'id'>): PublicProduct {
  const { id, ...rest } = overrides;
  return {
    id,
    type: 'Sheng',
    givenName: 'Spring cake',
    productName: 'Old tree tea',
    originCountry: 'China',
    originRegion: 'Yiwu',
    pricePerGramUSD: 0.5,
    stockGrams: 100,
    description: '',
    tastingNotes: [],
    imageUrl: '',
    status: 'Active',
    isPersonal: false,
    canReorder: false,
    isOneOfAKind: false,
    ...rest,
  };
}

const qualifyingProducts: PublicProduct[] = [
  product({
    id: 'tea-sheng-active',
    type: 'Sheng',
    givenName: 'Lao Man’e spring cake',
    productName: 'Bulang Mountain old tree',
    originCountry: 'Yunnan, China',
    originRegion: 'Yiwu',
  }),
  product({ id: 'tea-sheng-sold-out', type: 'Sheng', status: 'Sold Out', originRegion: 'Menghai' }),
  product({ id: 'tea-shou-active', type: 'Shou', givenName: 'Ripe cake', originRegion: 'Menghai' }),
  product({ id: 'tea-oolong', type: 'Oolong', originCountry: 'Taiwan', originRegion: 'Nantou' }),
];

describe('sellable Tea Reference catalogue', () => {
  it('derives sellable Sheng and Shou types and keeps their Pu’er family through its children', () => {
    const result = buildTeaReferenceCatalogue(preview(), qualifyingProducts);

    expect(result.types).toEqual([
      {
        id: 'sheng',
        name: 'Sheng',
        familyId: 'puer',
        facts: [statement('resolution-sheng-fact')],
        productIds: ['tea-sheng-active', 'tea-sheng-sold-out'],
      },
      {
        id: 'shou',
        name: 'Shou',
        familyId: 'puer',
        facts: [statement('resolution-shou-fact')],
        productIds: ['tea-shou-active'],
      },
    ]);
    expect(result.families).toEqual([
      {
        id: 'puer',
        name: 'Pu’er',
        facts: [statement('resolution-puer-fact')],
        productIds: ['tea-sheng-active', 'tea-sheng-sold-out', 'tea-shou-active'],
      },
    ]);
  });

  it('derives a controlled type without a handoff entity and omits Shou when no product matches it', () => {
    const entriesWithoutStyles = referenceEntries.filter(item => item.entityKind !== 'tea_style');
    const result = buildTeaReferenceCatalogue(preview(entriesWithoutStyles), [qualifyingProducts[0]]);

    expect(result.types).toEqual([
      { id: 'sheng', name: 'Sheng', familyId: 'puer', facts: [], productIds: ['tea-sheng-active'] },
    ]);
    expect(result.types.some(type => type.id === 'shou')).toBe(false);
    expect(result.families[0]?.id).toBe('puer');
  });

  it('ignores personal, non-tea, and non-sellable records', () => {
    const excluded = [
      product({ id: 'personal-sheng', isPersonal: true, type: 'Sheng' }),
      product({ id: 'non-tea', type: 'Teaware', productName: 'Sheng Yiwu tea tray' }),
      product({ id: 'archived-sheng', type: 'Sheng', status: 'Archived' as PublicProduct['status'] }),
    ];

    const result = buildTeaReferenceCatalogue(preview(), [...qualifyingProducts, ...excluded]);
    const surfacedIds = result.families.flatMap(family => family.productIds)
      .concat(result.types.flatMap(type => type.productIds), result.origins.flatMap(origin => origin.productIds));

    expect(surfacedIds).not.toContain('personal-sheng');
    expect(surfacedIds).not.toContain('non-tea');
    expect(surfacedIds).not.toContain('archived-sheng');
    expect(result.types.flatMap(type => type.productIds)).not.toContain('tea-oolong');
  });

  it('matches public origins at token boundaries while preserving every exact place level', () => {
    const result = buildTeaReferenceCatalogue(preview(), qualifyingProducts);

    expect(result.origins).toEqual([
      expect.objectContaining({ id: 'resolution-bulang', level: 'mountain', productIds: ['tea-sheng-active'] }),
      expect.objectContaining({ id: 'resolution-laomane', level: 'village', productIds: ['tea-sheng-active'] }),
      expect.objectContaining({ id: 'resolution-menghai', level: 'locality', productIds: ['tea-sheng-sold-out', 'tea-shou-active'] }),
      expect.objectContaining({ id: 'resolution-yiwu', level: 'tea_area', productIds: ['tea-sheng-active'] }),
      expect.objectContaining({ id: 'resolution-yunnan', level: 'major_region', productIds: ['tea-sheng-active'] }),
    ]);
    expect(result.origins.every(origin => origin.parentId === undefined)).toBe(true);
    expect(result.origins.some(origin => origin.id === 'resolution-jingmai')).toBe(false);
    expect(result.origins.some(origin => origin.id === 'resolution-taxonomy')).toBe(false);
    expect(result.origins.some(origin => origin.id === 'resolution-glossary')).toBe(false);
  });

  it('does not match origins from supplier or vendor data', () => {
    const supplierOnly = Object.assign(product({
      id: 'supplier-only',
      type: 'Sheng',
      givenName: 'Plain tea',
      productName: 'Plain cake',
      originCountry: 'China',
      originRegion: 'Unknown',
    }), { supplier: 'Vendor Valley', vendor: 'Vendor Valley' });

    const result = buildTeaReferenceCatalogue(preview(), [supplierOnly]);

    expect(result.origins.some(origin => origin.id === 'resolution-vendor-valley')).toBe(false);
  });

  it('copies only allowlisted public fields and returns deterministic, deduplicated ordering', () => {
    const unsafePreview = preview();
    Object.assign(unsafePreview, { privateVerification: [{ status: 'held', evidenceIds: ['secret'] }] });
    Object.assign(unsafePreview.sections[0].entries[0], { candidateValue: 'private candidate', parentId: 'guessed-parent' });
    Object.assign(unsafePreview.sections[0].entries[0].statements[0], { evidenceId: 'secret-evidence', status: 'held' });
    Object.assign(unsafePreview.sections[0].entries[0].statements[0].citation, { verification: 'private' });
    Object.assign(unsafePreview.sources[0], { held: true, candidate: 'private' });
    const products = [...qualifyingProducts, qualifyingProducts[0]];

    const forward = buildTeaReferenceCatalogue(unsafePreview, products);
    const reversed = buildTeaReferenceCatalogue({
      ...unsafePreview,
      sections: [...unsafePreview.sections].reverse().map(section => ({
        ...section,
        entries: [...section.entries].reverse(),
      })),
      sources: [...unsafePreview.sources].reverse(),
    }, [...products].reverse());

    expect(forward).toEqual(reversed);
    expect(JSON.stringify(forward)).not.toMatch(
      /privateVerification|verification|evidenceIds?|candidateValue|candidate|status|held|guessed-parent|secret/i,
    );
    expect(new Set(forward.types[0].productIds).size).toBe(forward.types[0].productIds.length);
    expect(forward.sources.map(source => source.sourceId)).toEqual(['source-a', 'source-z']);
  });
});
