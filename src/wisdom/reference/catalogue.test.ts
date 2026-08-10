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
  citation: {
    sourceId: `source-${id}`,
    label: 'Tea Institute, Reference (2026)',
    url: `https://example.com/${id}`,
  },
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
  product({
    id: 'tea-oolong-sheng-name',
    type: 'Oolong',
    givenName: 'Sheng Reserve',
    productName: 'Oolong',
    originCountry: 'Taiwan',
    originRegion: 'Nantou',
  }),
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

  it('qualifies the Pu’er family directly through an active family-matched tea and then includes its history', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({
        id: 'active-family-match',
        type: 'Dark',
        givenName: 'Pu’er family cake',
        productName: 'Unclassified dark tea',
      }),
      product({
        id: 'sold-out-family-history',
        type: 'Dark',
        status: 'Sold Out',
        givenName: 'Pu’er reserve cake',
        productName: 'Unclassified dark tea',
      }),
    ]);

    expect(result.types).toEqual([]);
    expect(result.families).toEqual([{
      id: 'puer',
      name: 'Pu’er',
      facts: [statement('resolution-puer-fact')],
      productIds: ['active-family-match', 'sold-out-family-history'],
    }]);
  });

  it('does not let a sold-out family match qualify the Pu’er family by itself', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({
        id: 'sold-out-family-only',
        type: 'Dark',
        status: 'Sold Out',
        givenName: 'Pu’er family cake',
        productName: 'Unclassified dark tea',
      }),
    ]);

    expect(result.types).toEqual([]);
    expect(result.families).toEqual([]);
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
    expect(result.types.flatMap(type => type.productIds)).not.toContain('tea-oolong-sheng-name');
  });

  it('does not let sold-out history qualify a controlled type by itself', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({ id: 'sold-out-sheng', type: 'Sheng', status: 'Sold Out' }),
    ]);

    expect(result.types).toEqual([]);
    expect(result.families).toEqual([]);
  });

  it('keeps sold-out history after an active tea independently qualifies the type', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({ id: 'active-sheng', type: 'Sheng', status: 'Active' }),
      product({ id: 'sold-out-sheng', type: 'Sheng', status: 'Sold Out' }),
    ]);

    expect(result.types.find(type => type.id === 'sheng')?.productIds).toEqual([
      'active-sheng',
      'sold-out-sheng',
    ]);
  });

  it('does not let a sold-out origin qualify a public place by itself', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({ id: 'sold-out-menghai', type: 'Sheng', status: 'Sold Out', originRegion: 'Menghai' }),
    ]);

    expect(result.origins).toEqual([]);
  });

  it('keeps sold-out history after an active tea independently qualifies the origin', () => {
    const result = buildTeaReferenceCatalogue(preview(), [
      product({ id: 'active-menghai', type: 'Sheng', status: 'Active', originRegion: 'Menghai' }),
      product({ id: 'sold-out-menghai', type: 'Sheng', status: 'Sold Out', originRegion: 'Menghai' }),
    ]);

    expect(result.origins.find(origin => origin.id === 'resolution-menghai')?.productIds).toEqual([
      'active-menghai',
      'sold-out-menghai',
    ]);
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

  it('retains the verified public ancestor chain of a directly matched origin', () => {
    const grandparent = entry('resolution-ancestor-region', 'Southwestern Range', 'major_region');
    const parent = Object.assign(
      entry('resolution-ancestor-area', 'Six Great Tea Mountains', 'tea_area'),
      { parentId: grandparent.id },
    );
    const child = Object.assign(
      entry('resolution-matched-village', 'Mansa', 'village'),
      { parentId: parent.id },
    );
    const matched = product({
      id: 'tea-mansa',
      type: 'Sheng',
      givenName: 'Spring cake',
      productName: 'Old tree tea',
      originCountry: 'China',
      originRegion: 'Mansa',
    });

    const result = buildTeaReferenceCatalogue(preview([grandparent, parent, child]), [matched]);

    expect(result.origins).toEqual([
      expect.objectContaining({
        id: parent.id,
        level: 'tea_area',
        parentId: grandparent.id,
        productIds: [matched.id],
      }),
      expect.objectContaining({
        id: grandparent.id,
        level: 'major_region',
        productIds: [matched.id],
      }),
      expect.objectContaining({
        id: child.id,
        level: 'village',
        parentId: parent.id,
        productIds: [matched.id],
      }),
    ]);
    expect(result.origins.find(origin => origin.id === grandparent.id)?.parentId).toBeUndefined();
  });

  it('omits missing, self-referential, and cyclic public parent relations without following them', () => {
    const missing = Object.assign(
      entry('resolution-missing-parent-child', 'Missing Parent Village', 'village'),
      { parentId: 'resolution-does-not-exist' },
    );
    const self = Object.assign(
      entry('resolution-self-parent', 'Self Parent Village', 'village'),
      { parentId: 'resolution-self-parent' },
    );
    const cycleA = Object.assign(
      entry('resolution-cycle-a', 'Cycle Start Village', 'village'),
      { parentId: 'resolution-cycle-b' },
    );
    const cycleB = Object.assign(
      entry('resolution-cycle-b', 'Unmatched Cycle Area', 'tea_area'),
      { parentId: 'resolution-cycle-a' },
    );
    const products = [
      product({ id: 'tea-missing-parent', originRegion: missing.label }),
      product({ id: 'tea-self-parent', originRegion: self.label }),
      product({ id: 'tea-cycle', originRegion: cycleA.label }),
    ];

    const result = buildTeaReferenceCatalogue(preview([missing, self, cycleA, cycleB]), products);

    expect(result.origins.map(origin => origin.id)).toEqual([
      cycleA.id,
      missing.id,
      self.id,
    ]);
    expect(result.origins.every(origin => origin.parentId === undefined)).toBe(true);
    expect(result.origins.some(origin => origin.id === cycleB.id)).toBe(false);
  });

  it('omits inverted and same-rank geographic parent relations', () => {
    const narrowParent = entry('resolution-narrow-parent', 'Narrow Parent Village', 'village');
    const invertedChild = Object.assign(
      entry('resolution-inverted-child', 'Matched Broad Area', 'tea_area'),
      { parentId: narrowParent.id },
    );
    const peerParent = entry('resolution-peer-parent', 'Peer Parent Village', 'village');
    const peerChild = Object.assign(
      entry('resolution-peer-child', 'Matched Peer Village', 'village'),
      { parentId: peerParent.id },
    );
    const result = buildTeaReferenceCatalogue(preview([
      narrowParent,
      invertedChild,
      peerParent,
      peerChild,
    ]), [
      product({ id: 'tea-inverted', originRegion: invertedChild.label }),
      product({ id: 'tea-peer', originRegion: peerChild.label }),
    ]);

    expect(result.origins.map(origin => origin.id)).toEqual([invertedChild.id, peerChild.id]);
    expect(result.origins.every(origin => origin.parentId === undefined)).toBe(true);
  });

  it('preserves Unicode letters and numbers when matching Chinese origins', () => {
    const yiwu = entry('resolution-chinese-yiwu', '易武', 'tea_area');
    const result = buildTeaReferenceCatalogue(preview([yiwu]), [
      product({ id: 'tea-chinese-exact', originRegion: '易武' }),
      product({ id: 'tea-chinese-token', originRegion: '云南 易武 古树' }),
    ]);

    expect(result.origins).toEqual([
      expect.objectContaining({
        id: yiwu.id,
        productIds: ['tea-chinese-exact', 'tea-chinese-token'],
      }),
    ]);
  });

  it('orders catalogue output by locale-independent code points', () => {
    const codePointPreview = preview([
      entry('a-origin', 'Alpha Place', 'tea_area'),
      entry('Z-origin', 'Zulu Place', 'tea_area'),
      entry('family-a', 'Puer', 'tea_family', [statement('a-fact'), statement('Z-fact')]),
      entry('style-sheng', 'Sheng', 'tea_style'),
    ]);
    codePointPreview.sources = [
      { ...codePointPreview.sources[0], sourceId: 'a-source' },
      { ...codePointPreview.sources[1], sourceId: 'Z-source' },
      { ...codePointPreview.sources[0], sourceId: '\u{E000}-source' },
      { ...codePointPreview.sources[1], sourceId: '\u{10000}-source' },
    ];
    const result = buildTeaReferenceCatalogue(codePointPreview, [
      product({ id: 'a-product', originRegion: 'Alpha Place Zulu Place' }),
      product({ id: 'Z-product', originRegion: 'Alpha Place Zulu Place' }),
    ]);

    expect(result.types[0].productIds).toEqual(['Z-product', 'a-product']);
    expect(result.families[0].facts.map(fact => fact.id)).toEqual(['Z-fact', 'a-fact']);
    expect(result.origins.map(origin => origin.id)).toEqual(['Z-origin', 'a-origin']);
    expect(result.sources.map(source => source.sourceId)).toEqual([
      'Z-source',
      'a-source',
      '\u{E000}-source',
      '\u{10000}-source',
    ]);
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
    expect(forward.types[0].facts[0].citation.sourceId).toBe('source-resolution-sheng-fact');
    expect(forward.sources.map(source => source.sourceId)).toEqual(['source-a', 'source-z']);
  });
});
