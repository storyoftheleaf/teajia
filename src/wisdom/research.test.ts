import { describe, expect, it } from 'vitest';
import {
  getEntryCitations,
  getEntryPotentialProfile,
  getEntryResearchSources,
  validateResearchBundle,
  type ResearchBundle,
} from './research';

const bundle: ResearchBundle = {
  sources: [{
    id: 'yunnan-sourcing-yi-bang-2025',
    publisher: 'Yunnan Sourcing',
    title: '2025 Yunnan Sourcing Yi Bang Wild Arbor Raw Pu-erh Tea Cake',
    url: 'https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake',
    kind: 'specialist-retailer',
    accessedAt: '2026-08-08',
    trust: 'qualified',
    privateEvidenceRef: 'private:yi-bang-evidence',
  }],
  citations: [{
    id: 'yi-bang-place-source',
    entryKind: 'region',
    entryId: 'yi-bang-village-yunnan',
    fields: ['description'],
    sourceIds: ['yunnan-sourcing-yi-bang-2025'],
    usage: 'qualified',
    qualification: 'Supports the place reference only, not a general sensory profile.',
  }],
  potentialProfiles: [],
};

describe('tea research provenance', () => {
  it('resolves public-safe sources through field-scoped citations', () => {
    expect(validateResearchBundle(bundle)).toEqual([]);
    expect(getEntryCitations(bundle, 'region', 'yi-bang-village-yunnan')).toHaveLength(1);
    expect(getEntryResearchSources(bundle, 'region', 'yi-bang-village-yunnan')).toEqual([
      expect.objectContaining({ publisher: 'Yunnan Sourcing' }),
    ]);
    expect(getEntryResearchSources(bundle, 'region', 'yi-bang-village-yunnan')[0])
      .not.toHaveProperty('trust');
    expect(getEntryResearchSources(bundle, 'region', 'yi-bang-village-yunnan')[0])
      .not.toHaveProperty('privateEvidenceRef');
  });

  it('does not invent a regional profile from one product page', () => {
    expect(getEntryPotentialProfile(bundle, 'region', 'yi-bang-village-yunnan')).toBeNull();
  });

  it('does not publish held-back citations', () => {
    const heldBack = structuredClone(bundle);
    heldBack.citations[0].usage = 'held_back';
    expect(getEntryCitations(heldBack, 'region', 'yi-bang-village-yunnan')).toEqual([]);
    expect(getEntryResearchSources(heldBack, 'region', 'yi-bang-village-yunnan')).toEqual([]);
  });

  it('rejects an unknown source reference', () => {
    const invalid = structuredClone(bundle);
    invalid.citations[0].sourceIds = ['missing-source'];
    expect(validateResearchBundle(invalid)).toContain(
      'Citation yi-bang-place-source references unknown source missing-source',
    );
  });

  it('rejects an unknown entry reference', () => {
    const invalid = structuredClone(bundle);
    invalid.citations[0].entryId = 'missing-region';
    expect(validateResearchBundle(invalid)).toContain(
      'Citation yi-bang-place-source references unknown region entry missing-region',
    );
  });

  it('rejects an unknown field reference', () => {
    const invalid = structuredClone(bundle);
    invalid.citations[0].fields = ['vendor'];
    expect(validateResearchBundle(invalid)).toContain(
      'Citation yi-bang-place-source references unknown field vendor on region:yi-bang-village-yunnan',
    );
  });

  it('requires limiting language for qualified citations', () => {
    const invalid = structuredClone(bundle);
    delete invalid.citations[0].qualification;
    expect(validateResearchBundle(invalid)).toContain(
      'Qualified citation yi-bang-place-source requires a qualification',
    );
  });

  it('rejects cross-category tasting ids', () => {
    const invalid = structuredClone(bundle);
    invalid.potentialProfiles = [{
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['honey'] },
      citationIds: ['yi-bang-place-source'],
    }];
    expect(validateResearchBundle(invalid)).toContain(
      'Potential profile region:yi-bang-village-yunnan has invalid body id honey',
    );
  });

  it('rejects profile citations from another entry scope', () => {
    const invalid = structuredClone(bundle);
    invalid.citations.push({
      ...invalid.citations[0],
      id: 'other-region-source',
      entryId: 'anji-county-zhejiang',
    });
    invalid.potentialProfiles = [{
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['full'] },
      citationIds: ['other-region-source'],
    }];
    expect(validateResearchBundle(invalid)).toContain(
      'Potential profile region:yi-bang-village-yunnan citation other-region-source targets region:anji-county-zhejiang',
    );
  });
});
