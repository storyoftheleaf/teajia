import { describe, expect, it } from 'vitest';
import {
  getEntryCitations,
  getEntryPotentialProfile,
  getEntryResearchSources,
  type ResearchBundle,
} from './research';
import { validateResearchBundle } from './researchValidation';
import type { WisdomPotentialProfile } from './types';

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

  it('rejects non-taxonomy potential profile fields', () => {
    for (const [field, value] of [['voiceNote', 'Copied prose'], ['quality', 10]] as const) {
      const invalid = structuredClone(bundle);
      invalid.potentialProfiles = [{
        entryKind: 'region',
        entryId: 'yi-bang-village-yunnan',
        tasting: { [field]: value },
        citationIds: ['yi-bang-place-source'],
      }];
      expect(validateResearchBundle(invalid as ResearchBundle)).toContain(
        `Potential profile region:yi-bang-village-yunnan has unsupported tasting category ${field}`,
      );
    }
  });

  it('rejects a taxonomy category whose value is not an array', () => {
    const invalid = structuredClone(bundle);
    invalid.potentialProfiles = [{
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: 'full' },
      citationIds: ['yi-bang-place-source'],
    } as unknown as WisdomPotentialProfile];
    expect(validateResearchBundle(invalid)).toContain(
      'Potential profile region:yi-bang-village-yunnan category body must be an array',
    );
  });

  it('rejects missing required research source fields', () => {
    const cases: Array<[string, (source: Record<string, unknown>) => void]> = [
      ['id', source => { source.id = ''; }],
      ['publisher', source => { delete source.publisher; }],
      ['title', source => { source.title = '   '; }],
      ['kind', source => { delete source.kind; }],
      ['accessedAt', source => { delete source.accessedAt; }],
      ['trust', source => { delete source.trust; }],
    ];
    for (const [field, mutate] of cases) {
      const invalid = structuredClone(bundle);
      mutate(invalid.sources[0] as unknown as Record<string, unknown>);
      expect(validateResearchBundle(invalid)).toContain(
        `Research source at index 0 has invalid ${field}`,
      );
    }
  });

  it('rejects invalid research source enums, dates, and URLs', () => {
    const cases: Array<[string, unknown, string]> = [
      ['id', 'Bad Source!', 'Research source at index 0 has invalid id Bad Source!'],
      ['kind', 'blog', 'Research source yunnan-sourcing-yi-bang-2025 has invalid kind blog'],
      ['trust', 'trusted', 'Research source yunnan-sourcing-yi-bang-2025 has invalid trust trusted'],
      ['accessedAt', '08/08/2026', 'Research source yunnan-sourcing-yi-bang-2025 has invalid accessedAt 08/08/2026'],
      ['url', 'ftp://example.com/tea', 'Research source yunnan-sourcing-yi-bang-2025 has invalid url ftp://example.com/tea'],
    ];
    for (const [field, value, message] of cases) {
      const invalid = structuredClone(bundle);
      (invalid.sources[0] as unknown as Record<string, unknown>)[field] = value;
      expect(validateResearchBundle(invalid)).toContain(message);
    }
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

  it('rejects a public potential profile that also cites held-back evidence', () => {
    const invalid = structuredClone(bundle);
    invalid.citations.push({
      ...invalid.citations[0],
      id: 'held-back-source',
      usage: 'held_back',
    });
    invalid.potentialProfiles = [{
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['full'] },
      citationIds: ['yi-bang-place-source', 'held-back-source'],
    }];
    expect(validateResearchBundle(invalid)).toContain(
      'Potential profile region:yi-bang-village-yunnan cannot cite held-back citation held-back-source',
    );
  });
});
