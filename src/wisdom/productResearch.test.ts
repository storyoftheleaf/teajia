import { describe, expect, it } from 'vitest';
import type { TeaReferenceProduct } from './productIdentity';
import { resolveProductResearch } from './productResearch';
import type { PublicResearchBundle } from './research';
import type { WisdomEntryKind } from './types';

const scopes: Array<{ kind: WisdomEntryKind; id: string }> = [
  { kind: 'namedTea', id: 'courage' },
  { kind: 'producer', id: 'menghai-tea-factory' },
  { kind: 'cultivar', id: 'jin-xuan' },
  { kind: 'region', id: 'nantou-county' },
  { kind: 'style', id: 'gaba-oolong' },
];

const bundle: PublicResearchBundle = {
  sources: [{
    id: 'profile-source',
    publisher: 'Tea Research Institute',
    title: 'Scoped profiles',
    url: 'https://example.com/profiles',
    kind: 'institutional',
    accessedAt: '2026-08-08',
  }],
  citations: scopes.map(({ kind, id }) => ({
    id: `${kind}-profile-citation`,
    entryKind: kind,
    entryId: id,
    fields: ['potentialProfile'],
    sourceIds: ['profile-source'],
    usage: 'usable' as const,
  })),
  potentialProfiles: scopes.map(({ kind, id }) => ({
    entryKind: kind,
    entryId: id,
    tasting: { flavor: [kind === 'namedTea' ? 'honey' : 'cocoa'] },
    citationIds: [`${kind}-profile-citation`],
  })),
};

const product: TeaReferenceProduct = {
  name: 'Courage Jin Xuan GABA Oolong Menghai Tea Factory',
  variant: 'Courage',
  chineseName: '勇气',
  cultivar: 'jin-xuan',
  origin: 'Nantou County',
  type: 'Black',
};

describe('product Wisdom research resolution', () => {
  it('selects the first cited profile in conservative scope order', () => {
    const result = resolveProductResearch(product, bundle);

    expect(result).toMatchObject({
      entryKind: 'namedTea',
      entryId: 'courage',
      profile: { tasting: { flavor: ['honey'] } },
      citations: [{ id: 'namedTea-profile-citation' }],
    });
  });

  it('falls through named tea, producer, cultivar, region, then style and returns null after style', () => {
    for (const [index, expected] of scopes.entries()) {
      const narrowed = {
        ...bundle,
        potentialProfiles: bundle.potentialProfiles.slice(index),
      };
      expect(resolveProductResearch(product, narrowed)).toMatchObject({
        entryKind: expected.kind,
        entryId: expected.id,
      });
    }

    expect(resolveProductResearch(product, { ...bundle, potentialProfiles: [] })).toBeNull();
  });

  it('does not copy research into or otherwise mutate the product tasting', () => {
    const withOwnerTasting = {
      ...product,
      tasting: { flavor: ['orchid'] },
      tastingSource: 'owner' as const,
    };
    const before = structuredClone(withOwnerTasting);

    resolveProductResearch(withOwnerTasting, bundle);

    expect(withOwnerTasting).toEqual(before);
    expect(withOwnerTasting.tasting).toEqual({ flavor: ['orchid'] });
  });

  it('ignores an uncited profile', () => {
    const uncited = structuredClone(bundle);
    uncited.citations = [];

    expect(resolveProductResearch(product, uncited)).toBeNull();
  });

  it('returns only sources attached to the selected profile citations in stable order', () => {
    const scoped = structuredClone(bundle);
    scoped.sources = [
      ...scoped.sources,
      {
        id: 'unrelated-field-source',
        publisher: 'Unrelated Field Publisher',
        title: 'A factual field source',
        url: 'https://example.com/unrelated-field',
        kind: 'institutional',
        accessedAt: '2026-08-08',
      },
      {
        id: 'earlier-profile-source',
        publisher: 'Earlier Profile Publisher',
        title: 'Another scoped profile source',
        url: 'https://example.com/earlier-profile',
        kind: 'scientific',
        accessedAt: '2026-08-07',
      },
    ];
    scoped.citations.push({
      id: 'namedTea-unrelated-field',
      entryKind: 'namedTea',
      entryId: 'courage',
      fields: ['description'],
      sourceIds: ['unrelated-field-source'],
      usage: 'usable',
    });
    scoped.citations[0].sourceIds = ['profile-source', 'earlier-profile-source'];

    expect(resolveProductResearch(product, scoped)?.sources.map(source => source.id)).toEqual([
      'earlier-profile-source',
      'profile-source',
    ]);
  });
});
