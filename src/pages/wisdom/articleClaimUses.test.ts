import { describe, expect, it } from 'vitest';
import type { ArticleClaimUse } from '../../wisdom/reference/claims';
import { claimUseFlag, reviewClaimUse, wisdomDestinations } from './articleClaimUses';
import { GRADE_PILOT_PAGES, gongTingDefinition, gradePilotClaims } from './gradePilotFixtures';

const prose: ArticleClaimUse = { articleId: 'a', blockIndex: 2, claimId: 'gong-ting:definition', revUsed: 1, useKind: 'prose' };

describe('article claim review against a claims set', () => {
  it('flags rev 1 prose once rev 2 is current, with the old and the new text', () => {
    const review = reviewClaimUse(prose, gradePilotClaims(2));
    expect(review.needsReview).toBe(true);
    expect(claimUseFlag(review)).toBe('Needs review: claim changed, rev 1 → 2');
    expect(review.textUsed).toBe(gongTingDefinition(1).text);
    expect(review.currentText).toBe(gongTingDefinition(2).text);
    expect(review.textUsed).not.toBe(review.currentText);
  });

  it('shows the editor the cited text after withdrawal removes the claim from the public registry', () => {
    const review = reviewClaimUse(prose, [], { claim_id: prose.claimId, rev_used: 1, text: 'Former wording.', withdrawn: true });
    expect(claimUseFlag(review)).toBe('Needs review: claim withdrawn after rev 1');
    expect(review.textUsed).toBe('Former wording.');
    expect(review.currentText).toBeNull();
  });

  it('does not flag the same prose while rev 1 is still current', () => {
    const review = reviewClaimUse(prose, gradePilotClaims(1));
    expect(review.needsReview).toBe(false);
    expect(claimUseFlag(review)).toBeNull();
  });

  it('never flags a live block, and flags prose whose claim was withdrawn or is missing', () => {
    expect(reviewClaimUse({ ...prose, useKind: 'live_block' }, gradePilotClaims(2)).needsReview).toBe(false);
    const withdrawn = gradePilotClaims(2).map(claim => (
      claim.claimId === prose.claimId ? { ...claim, reviewState: 'withdrawn' as const } : claim
    ));
    const review = reviewClaimUse(prose, withdrawn);
    expect(review.needsReview).toBe(true);
    expect(review.currentText).toBeNull();
    expect(claimUseFlag(review)).toBe('Needs review: claim withdrawn after rev 1');
    expect(reviewClaimUse(prose, []).needsReview).toBe(true);
  });
});

describe('Wisdom destinations from an article', () => {
  const pages = [
    ...GRADE_PILOT_PAGES,
    { id: 'menghai-county', label: 'Menghai County', kind: 'tea_area' as const, visibility: 'public' as const },
  ];
  const claimIds = ['gong-ting:definition', 'gong-ting:blending', 'menghai-county:scope', 'unknown-page:x'];

  it('gives a signed-out reader public pages only', () => {
    expect(wisdomDestinations(claimIds, pages, false).map(d => d.href)).toEqual(['/wisdom/region/menghai-county']);
  });

  it('gives a signed-in editor the draft grade page too, once per page', () => {
    expect(wisdomDestinations(claimIds, pages, true).map(d => d.href)).toEqual([
      '/wisdom/grade/gong-ting',
      '/wisdom/region/menghai-county',
    ]);
  });
});
