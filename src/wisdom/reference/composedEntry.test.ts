import { describe, expect, it } from 'vitest';
import type { PublicClaim } from './claims';
import { entryClaimUses, entryLinkFor, entrySegments } from './composedEntry';
import { COMPOSED_FIXTURES } from '../../pages/preview/wisdomPilot/composedFixtures';

const claim = (claimId: string, axis: PublicClaim['axis'], label: string, reviewState: PublicClaim['reviewState'] = 'approved'): PublicClaim => {
  const [pageId, sectionKey] = claimId.split(':');
  return { claimId, pageId, sectionKey, axis, label, basis: 'trade_knowledge', listingEligible: false, appliesWhen: {}, terms: [], rev: 1, scope: '', text: label, sourceIds: [], reviewState };
};

describe('composed entries', () => {
  it('splits marked terms from prose', () => {
    expect(entrySegments('A [ripe pu’er](shou:definition) brick.')).toEqual([
      { text: 'A ' }, { text: 'ripe pu’er', claimId: 'shou:definition' }, { text: ' brick.' },
    ]);
  });

  it('links a term only when its page says more than the sentence', () => {
    const alone = [claim('solo:only', 'type', 'Only')];
    expect(entryLinkFor('solo:only', alone)).toBeNull();
    const shou = [claim('shou:definition', 'type', 'What ripe pu’er is'), claim('shou:wet-piling', 'process', 'Wet piling')];
    expect(entryLinkFor('shou:wet-piling', shou)).toBe('/wisdom/type/shou#reference-wet-piling');
    expect(entryLinkFor('shou:definition', [shou[0], { ...shou[1], reviewState: 'withdrawn' }])).toBeNull();
  });

  it('opens a place at the top of its page', () => {
    const menghai = [claim('menghai-county:scope', 'place', 'Western Xishuangbanna'), claim('menghai-county:mengsong-naka', 'place', 'Mengsong and Naka')];
    expect(entryLinkFor('menghai-county:mengsong-naka', menghai)).toBe('/wisdom/region/menghai-county');
  });

  it('keeps the pilot rules on the target entries', () => {
    const naka = COMPOSED_FIXTURES.naka.entry;
    expect(naka.notice).toBeUndefined();
    const text = [...naka.paragraphs, naka.brewing!].map(p => p.text).join(' ');
    expect(text).not.toMatch(/Gong Ting|Dayi|7572|years old|gushu|old-tree|fruit|cream|aroma|19\d\d|20\d\d/i);
    const brick = COMPOSED_FIXTURES['ripe-brick'].entry;
    expect(entryClaimUses(brick)).toEqual(['shou:definition', 'shou:wet-piling', 'shou:age-young', 'shou:age-aged']);
    expect(brick.paragraphs.map(p => p.text).join(' ')).not.toMatch(/—/);
  });
});
