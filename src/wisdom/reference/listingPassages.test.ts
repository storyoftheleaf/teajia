import { describe, expect, it } from 'vitest';
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
    pageId, sectionKey, label: partial.claimId, listingEligible: true, terms: [], rev: 1,
    scope: 'test', text: partial.claimId, sourceIds: [], reviewState: 'approved', ...partial,
  };
}

describe('resolveListingPassages: the pilot cases', () => {
  it('gives Naka the Mengsong sentence and nothing on grade, maker, vintage, tree age or sensory', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES.naka.facts, PILOT_FIXTURE_CLAIMS);
    const [first] = listing.passages;
    expect(first.claim.claimId).toBe('menghai-county:mengsong-naka');
    expect(first.claim.text).toContain('TeaDB places Naka in Mengsong');
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

  it('gives the explicit-grade fixture the Gong Ting passage first and both seller observations', () => {
    const listing = resolveListingPassages(PILOT_FIXTURES['gong-ting-external'].facts, PILOT_FIXTURE_CLAIMS);
    expect(ids(listing.passages.map(passage => passage.claim))).toEqual(['gong-ting:definition', 'shou:wet-piling']);
    expect(ids(listing.styleReferences)).toEqual(['gong-ting:seller-jingmai-loose', 'gong-ting:seller-nannuo-2006-cake']);
    expect(listing.styleReferences.every(reference => reference.attribution?.sourceRole === 'seller_own_batch')).toBe(true);
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

  it('ranks by axis, then by more conditions, then by claim id; two at most, different axes', () => {
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

  it('returns sensory observations only as style references, and only with attribution', () => {
    const attribution = { sourceId: 's', sourceRole: 'taster' as const, sample: 'one cup' };
    const claims = [
      claim({ claimId: 's:attributed', axis: 'sensory_observation', appliesWhen: { type: 'Shou' }, listingEligible: false, attribution }),
      claim({ claimId: 's:unattributed', axis: 'sensory_observation', appliesWhen: { type: 'Shou' }, listingEligible: true }),
    ];
    const listing = resolveListingPassages(facts, claims);
    expect(listing.passages).toEqual([]);
    expect(ids(listing.styleReferences)).toEqual(['s:attributed']);
  });
});
