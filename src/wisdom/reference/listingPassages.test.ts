import { describe, expect, it } from 'vitest';
import type { PublicTeaReferencePage } from './types';
import type { PublicClaim } from './claims';
import { appliesTo, resolveListingPassages } from './listingPassages';
import { listingFacts } from './listingFacts';
import { PILOT_FIXTURE_CLAIMS } from '../../pages/preview/wisdomPilot/fixtureClaims';
import { PILOT_FIXTURES, TYPE_ONLY_FULL_FACTS } from '../../pages/preview/wisdomPilot/fixtureProducts';
import { applyRevisionOverrides } from '../../pages/preview/wisdomPilot/revisionOverride';

const ids = (claims: readonly { claimId: string }[]) => claims.map(claim => claim.claimId);
const passageIds = (claims: readonly PublicClaim[], facts = PILOT_FIXTURES.naka.facts) =>
  resolveListingPassages(facts, claims).passages.map(passage => passage.claim.claimId);

function claim(partial: Partial<PublicClaim> & Pick<PublicClaim, 'claimId' | 'axis' | 'appliesWhen'>): PublicClaim {
  const [pageId, sectionKey] = partial.claimId.split(':');
  return {
    pageId, sectionKey, label: partial.claimId, basis: 'sourced', listingEligible: true, terms: [], rev: 1,
    scope: 'test', text: partial.claimId, sourceIds: [], reviewState: 'approved', ...partial,
  };
}

describe('resolveListingPassages: the pilot cases', () => {
  it('gives Naka the Mengsong sentence and nothing on grade, maker, vintage, tree age or sensory', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES.naka.facts, PILOT_FIXTURE_CLAIMS);
    const [first] = listing.passages;
    expect(first.claim.claimId).toBe('menghai-county:mengsong-naka');
    expect(first.claim.text).toContain('Naka is a village in Mengsong');
    expect(first.gridField).toBe('location');
    expect(first.wisdomHref).toBe('/wisdom/region/menghai-county#mengsong-naka');
    expect(listing.styleReferences).toEqual([]);
    const axes = listing.passages.map(passage => passage.claim.axis);
    expect(axes).not.toContain('grade');
    expect(axes).not.toContain('maker_history');
    expect(axes).not.toContain('sensory_observation');
    const text = listing.passages.map(passage => passage.claim.text).join(' ');
    expect(text).not.toMatch(/Gong Ting|Dayi|1973|1975|7572|years old|gushu|old-tree|fruit|cream|hardwood|aroma/i);
  });

  it('gives the type-only fixture wet piling', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['type-only'].facts, PILOT_FIXTURE_CLAIMS);
    expect(ids(listing.passages.map(passage => passage.claim))).toEqual(['shou:wet-piling']);
    expect(listing.passages[0].claim.text).toContain('wet piling');
  });

  it('gives the type-only fixture identical output with the withheld fields added back', () => {
    expect(TYPE_ONLY_FULL_FACTS.originParts).toEqual(['yunnan', 'china']);
    expect(TYPE_ONLY_FULL_FACTS.form).toBe('Loose');
    expect(resolveListingPassages(TYPE_ONLY_FULL_FACTS, PILOT_FIXTURE_CLAIMS))
      .toEqual(resolveListingPassages(PILOT_FIXTURES['type-only'].facts, PILOT_FIXTURE_CLAIMS));
  });

  it('gives a product merely named "Gong Ting" no grade passage', () => {
    const facts = listingFacts({ type: 'Shou Puer', form: 'Loose', originRegion: 'Jingmai Mountain, Yunnan', name: 'Jingmai Mountain Gong Ting' });
    const listing = resolveListingPassages(facts, PILOT_FIXTURE_CLAIMS);
    expect(listing.passages.map(passage => passage.claim.axis)).not.toContain('grade');
    expect(listing.styleReferences).toEqual([]);
  });

  it('gives the explicit-grade fixture the Gong Ting passage first and one Gong Ting taste sentence', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    expect(ids(listing.passages.map(passage => passage.claim))).toEqual(['gong-ting:definition', 'shou:wet-piling']);
    expect(ids(listing.styleReferences)).toEqual(['gong-ting:what-people-notice']);
    expect(listing.styleReferences[0].attribution).toBeUndefined();
    expect(listing.styleReferences[0].text).not.toMatch(/Yunnan Sourcing|Yang|study/);
  });
});

describe('the revision switch', () => {
  const resolve = (overrides: Record<string, number | 'withdrawn'>) => {
    const claims = applyRevisionOverrides(PILOT_FIXTURE_CLAIMS, overrides);
    return Object.fromEntries(Object.values(PILOT_FIXTURES).map(fixture => [
      fixture.slug, resolveListingPassages(fixture.facts, claims),
    ]));
  };

  it('changes the Gong Ting wording only', () => {
    const rev2 = resolve({ 'gong-ting:definition': 2 });
    const rev1 = resolve({ 'gong-ting:definition': 1 });
    const gongTing = (listing: typeof rev1[string]) => listing.passages.find(passage => passage.claim.claimId === 'gong-ting:definition')!.claim;
    expect(gongTing(rev2['gong-ting-external']).text).toContain('loose ripe pu\'er in the Menghai Tea Alliance standard');
    expect(gongTing(rev1['gong-ting-external']).text).toContain('palace');
    expect(gongTing(rev1['gong-ting-external']).rev).toBe(1);
    expect(gongTing(rev1['gong-ting-external']).scope).not.toBe(gongTing(rev2['gong-ting-external']).scope);
    expect(rev1.naka).toEqual(rev2.naka);
    expect(rev1['type-only']).toEqual(rev2['type-only']);
    expect(rev1['gong-ting-external'].styleReferences).toEqual(rev2['gong-ting-external'].styleReferences);
  });

  it('withdrawing removes the passage and leaves the other listings alone', () => {
    const withdrawn = resolve({ 'gong-ting:definition': 'withdrawn' });
    const base = resolve({});
    expect(ids(withdrawn['gong-ting-external'].passages.map(passage => passage.claim))).toEqual(['shou:wet-piling']);
    expect(withdrawn.naka).toEqual(base.naka);
    expect(withdrawn['type-only']).toEqual(base['type-only']);
  });
});

describe('resolveListingPassages: contract rules', () => {
  const facts = listingFacts({ type: 'Shou', grade: 'gong-ting', originRegion: 'Mengsong, Menghai', name: 'Naka Gushu', form: 'Cake' });

  it('never matches an empty applies_when', () => {
    expect(appliesTo({}, facts)).toBe(false);
    expect(appliesTo({ origin_includes: [] }, facts)).toBe(false);
  });

  it('matches process_in_name on the name alone, and only beside type', () => {
    const gaba = listingFacts({ type: 'Oolong', originRegion: '', name: 'Gaba High Mountain' });
    expect(appliesTo({ type: 'Oolong', process_in_name: ['gaba'] }, gaba)).toBe(true);
    expect(appliesTo({ type: 'Red', process_in_name: ['gaba'] }, gaba)).toBe(false);
    expect(appliesTo({ process_in_name: ['gaba'] }, gaba)).toBe(false);
    expect(appliesTo({ type: 'Oolong', process_in_name: ['gaba'] }, listingFacts({ type: 'Oolong', name: 'Alishan High Mountain' }))).toBe(false);
  });

  it('matches name_any on any one name, and only beside origin_includes', () => {
    expect(appliesTo({ origin_includes: ['mengsong'], name_any: ['naka', 'lapsang'] }, facts)).toBe(true);
    expect(appliesTo({ origin_includes: ['mengsong'], name_any: ['lapsang', 'zhengshan'] }, facts)).toBe(false);
    expect(appliesTo({ name_any: ['naka'] }, facts)).toBe(false);
  });

  it('refuses name_includes without origin_includes', () => {
    expect(appliesTo({ name_includes: ['naka'] }, facts)).toBe(false);
    expect(appliesTo({ origin_includes: ['mengsong'], name_includes: ['naka'] }, facts)).toBe(true);
  });

  it('ANDs keys and uses whole-part origin equality', () => {
    expect(appliesTo({ type: 'Shou', form: 'Loose' }, facts)).toBe(false);
    expect(appliesTo({ origin_includes: ['meng'] }, facts)).toBe(false);
    expect(appliesTo({ origin_includes: ['menghai', 'mengsong'] }, facts)).toBe(true);
  });

  it('only shows approved, listing-eligible claims and never maker history or terminology', () => {
    const claims = [
      claim({ claimId: 'a:maker', axis: 'maker_history', appliesWhen: { type: 'Shou' } }),
      claim({ claimId: 'a:term', axis: 'terminology', appliesWhen: { type: 'Shou' } }),
      claim({ claimId: 'a:not-eligible', axis: 'type', appliesWhen: { type: 'Shou' }, listingEligible: false }),
      claim({ claimId: 'a:draft', axis: 'type', appliesWhen: { type: 'Shou' }, reviewState: 'draft', rev: null }),
      claim({ claimId: 'a:withdrawn', axis: 'type', appliesWhen: { type: 'Shou' }, reviewState: 'withdrawn' }),
    ];
    expect(resolveListingPassages(facts, claims).passages).toEqual([]);
  });

  it('ranks by matching conditions, then axis, then claim id; two at most, different axes', () => {
    const claims = [
      claim({ claimId: 'p:process', axis: 'process', appliesWhen: { type: 'Shou' } }),
      claim({ claimId: 'b:type', axis: 'type', appliesWhen: { type: 'Shou' } }),
      claim({ claimId: 'a:type', axis: 'type', appliesWhen: { type: 'Shou' } }),
      claim({ claimId: 'z:type-narrow', axis: 'type', appliesWhen: { type: 'Shou', form: 'Cake' } }),
      claim({ claimId: 'g:grade', axis: 'grade', appliesWhen: { grade: 'gong-ting' } }),
      claim({ claimId: 'g:grade-2', axis: 'grade', appliesWhen: { grade: 'gong-ting', type: 'Shou' } }),
    ];
    expect(passageIds(claims, facts)).toEqual(['g:grade-2', 'z:type-narrow']);
    expect(passageIds(claims.filter(entry => entry.axis !== 'grade' && entry.claimId !== 'z:type-narrow'), facts))
      .toEqual(['a:type', 'p:process']);
  });

  it('leads with a corroborated village before a broad grade or type', () => {
    const claims = [
      claim({ claimId: 'g:grade', axis: 'grade', appliesWhen: { grade: 'gong-ting' } }),
      claim({ claimId: 's:type', axis: 'type', appliesWhen: { type: 'Shou', form: 'Cake' } }),
      claim({ claimId: 'v:place', axis: 'place', appliesWhen: { origin_includes: ['mengsong'], name_includes: ['naka'] } }),
    ];
    expect(passageIds(claims, facts)).toEqual(['v:place', 'g:grade']);
  });

  it('requires a public destination and style evidence on a normal listing', () => {
    const base = { id: 'family', slug: 'family', label: 'Family', kind: 'tea_family' as const, sourceIds: [] };
    const section = { key: 'process', label: 'Process', text: 'Explanation', sourceIds: [] };
    const pages = [{ ...base, sections: [section, { ...section, key: 'taste' }] }];
    const appliesWhen = { type: 'Shou' };
    const process = claim({ claimId: 'family:process', pageId: 'family', sectionKey: 'process', axis: 'process', appliesWhen });
    const taste = claim({ claimId: 'family:taste', pageId: 'family', sectionKey: 'taste', axis: 'sensory_observation', appliesWhen, sourceIds: [] });
    const draftPageClaim = { ...process, claimId: 'unreleased:process', pageId: 'unreleased' };
    const listing = resolveListingPassages(facts, [process, draftPageClaim, taste], pages);
    expect(listing.passages.map(passage => passage.wisdomHref)).toEqual(['/wisdom/family/family#process']);
    expect(listing.styleReferences).toEqual([]);
    expect(resolveListingPassages(facts, [{ ...taste, sourceIds: ['source'] }], pages).styleReferences).toHaveLength(1);
  });

  it('returns sensory claims only as style references, with or without attribution', () => {
    const attribution = { sourceId: 's', sourceRole: 'taster' as const, sample: 'one cup' };
    const claims = [
      claim({ claimId: 's:attributed', axis: 'sensory_observation', appliesWhen: { type: 'Shou' }, listingEligible: false, attribution }),
      claim({ claimId: 's:common', axis: 'sensory_observation', appliesWhen: { type: 'Shou' }, listingEligible: true, basis: 'trade_knowledge' }),
    ];
    const listing = resolveListingPassages(facts, claims);
    expect(listing.passages).toEqual([]);
    expect(ids(listing.styleReferences)).toEqual(['s:attributed']);
  });

  it('keeps only the most specific style reference: a grade beats a type', () => {
    const claims = [
      claim({ claimId: 'shou:common-impressions', axis: 'sensory_observation', appliesWhen: { type: 'Shou' }, listingEligible: false, basis: 'trade_knowledge' }),
      claim({ claimId: 'gong-ting:common-impressions', axis: 'sensory_observation', appliesWhen: { grade: 'gong-ting' }, listingEligible: false, basis: 'trade_knowledge' }),
    ];
    const listing = resolveListingPassages({ ...facts, grade: 'gong-ting' }, claims);
    expect(ids(listing.styleReferences)).toEqual(['gong-ting:common-impressions']);
  });
});

describe('an explicitly linked named history', () => {
  const page = (id: string, keys: string[], kind: PublicTeaReferencePage['kind'] = 'named_tea'): PublicTeaReferencePage =>
    ({ id, slug: id, kind, label: id, sourceIds: ['source'], sections: keys.map(key => ({ key, label: key, text: key, sourceIds: ['source'] })) });
  const history = (id: string, key: string, overrides: Partial<PublicClaim> = {}) => claim({
    claimId: id + ':' + key, axis: 'named_tea_history', appliesWhen: { named_tea: id }, sourceIds: ['source'], ...overrides,
  });
  const pages = [page('y562', ['carton']), page('another-tea', ['z', 'b', 'a', 'c']), page('shou', ['process'], 'tea_type')];
  const general = claim({ claimId: 'shou:process', axis: 'process', appliesWhen: { type: 'Shou' } });
  const claims = [general, history('another-tea', 'a'), history('another-tea', 'b'), history('another-tea', 'c'),
    history('another-tea', 'z'), history('y562', 'carton')];
  const facts = { ...listingFacts({ type: 'Shou', name: 'Y562' }), namedTeaId: 'another-tea' };

  it('keeps every sourced section in page order, then general context, for a second identity', () => {
    const passages = resolveListingPassages(facts, claims, pages).passages;
    expect(passages.map(p => p.wisdomHref)).toEqual([
      '/wisdom/named/another-tea#z', '/wisdom/named/another-tea#b', '/wisdom/named/another-tea#a', '/wisdom/named/another-tea#c',
      '/wisdom/type/shou#process',
    ]);
    expect(resolveListingPassages({ ...facts, namedTeaId: undefined }, claims, pages).passages.map(p => p.claim.claimId))
      .toEqual(['shou:process']);
  });

  it('reflects revised or withdrawn sections and drops unpublished pages, ineligible text and missing sources', () => {
    const updated = [history('another-tea', 'z', { text: 'Revised wording', rev: 2 }),
      history('another-tea', 'b', { withdrawn: { at: '2026-11-23', reason: 'Source corrected' } }),
      history('another-tea', 'a', { sourceIds: [] }), history('another-tea', 'c', { listingEligible: false }), general];
    expect(resolveListingPassages(facts, updated, pages).passages.map(p => p.claim.text)).toEqual(['Revised wording', general.text]);
    expect(resolveListingPassages(facts, claims, pages.filter(p => p.id !== 'another-tea')).passages.map(p => p.claim.claimId))
      .toEqual(['shou:process']);
  });
});
