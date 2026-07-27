import { describe, expect, it } from 'vitest';
import { recognizeAmbiguity, recognizeForm, recognizeRegion, recognizeType } from './recognition';

describe('recognizeAmbiguity', () => {
  it('flags bare puerh spellings', () => {
    expect(recognizeAmbiguity('Puerh')).toBe(true);
    expect(recognizeAmbiguity('Pu-erh cake')).toBe(true);
    expect(recognizeAmbiguity("2019 Pu'er")).toBe(true);
  });

  it('does not flag text with no puerh mention', () => {
    expect(recognizeAmbiguity('Shou')).toBe(false);
    expect(recognizeAmbiguity('')).toBe(false);
  });
});

describe('recognizeType', () => {
  it('returns null for empty or unrecognised text', () => {
    expect(recognizeType('')).toBeNull();
    expect(recognizeType('Unlabelled bag from the market')).toBeNull();
  });

  it('resolves single dialect words the shared vocabulary already knows', () => {
    expect(recognizeType('Sheng')).toBe('Sheng');
    expect(recognizeType('Shou')).toBe('Shou');
    // These were never in InputParser's old local alias table but are already
    // part of vocabulary.ts's canonical TYPE_ALIASES; free coverage gained by
    // reading from the one shared source instead of a duplicate.
    expect(recognizeType('Dancong')).toBe('Oolong');
    expect(recognizeType('Yancha')).toBe('Oolong');
  });

  it('never resolves a bare puerh spelling to Sheng or Shou', () => {
    expect(recognizeType('Puerh')).toBeNull();
    expect(recognizeType('Puerh Cake')).toBeNull();
  });

  it('still resolves type when an unambiguous word accompanies a bare puerh mention', () => {
    expect(recognizeType('Shou Puer 2019')).toBe('Shou');
  });

  it('keeps "Red" followed by a name word as part of the tea name, not the type', () => {
    expect(recognizeType('Red Robe')).toBeNull();
    expect(recognizeType('Red Label')).toBeNull();
    // Ruby 18's alt name is literally "Red Jade" in the variety database, so the
    // derived layer must not be allowed to resolve it via that entry.
    expect(recognizeType('Red Jade')).toBeNull();
  });

  it('resolves bare "Red" normally when not followed by a name word', () => {
    expect(recognizeType('Red')).toBe('Red');
    expect(recognizeType('Red 2019')).toBe('Red');
  });

  it('resolves curated bilingual phrases that are not single dialect words', () => {
    expect(recognizeType('Hong Cha')).toBe('Red');
    expect(recognizeType('Silver Needle')).toBe('White');
    expect(recognizeType('2019 Da Hong Pao')).toBe('Oolong');
    expect(recognizeType('陈年六堡茶')).toBe('Dark');
  });

  it('derives a type from a wisdom-base variety name not in the curated phrase list', () => {
    // Neither of these appears in the curated TEA_TYPE_RULES phrases; only
    // the automatic variety-name layer can resolve them.
    expect(recognizeType('Enshi Yu Lu')).toBe('Green');
    expect(recognizeType('Zhu Ye Qing')).toBe('Green');
  });
});

describe('recognizeForm', () => {
  it('returns null for empty or unrecognised text', () => {
    expect(recognizeForm('')).toBeNull();
    expect(recognizeForm('Unlabelled item from the market')).toBeNull();
  });

  it('resolves single-word forms', () => {
    expect(recognizeForm('Cake')).toBe('Cake');
    expect(recognizeForm('Tuo')).toBe('Tuo');
    expect(recognizeForm('Loose')).toBe('Loose');
  });

  it('resolves CJK form characters', () => {
    expect(recognizeForm('饼')).toBe('Cake');
    expect(recognizeForm('沱')).toBe('Tuo');
    expect(recognizeForm('砖')).toBe('Brick');
  });

  it('resolves curated multi-word phrases', () => {
    expect(recognizeForm('mao cha')).toBe('Loose');
    expect(recognizeForm('dragon ball')).toBe('Ball');
    expect(recognizeForm('tea bag')).toBe('Bag');
  });
});

describe('recognizeRegion', () => {
  it('returns null for empty or unrecognised text', () => {
    expect(recognizeRegion('')).toBeNull();
    expect(recognizeRegion('Unlabelled bag from the market')).toBeNull();
  });

  it('matches a multi-word region ahead of a bare substring', () => {
    expect(recognizeRegion('Dong Ding Oolong 2020')).toBe('Dong Ding');
  });

  it('matches a single-word region as a whole token', () => {
    expect(recognizeRegion('2019 Yiwu Sheng')).toBe('Yiwu');
  });

  it('merges in extra region names a caller already knows about', () => {
    expect(recognizeRegion('My Secret Garden tea', ['My Secret Garden'])).toBe('My Secret Garden');
    expect(recognizeRegion('nothing relevant here', ['My Secret Garden'])).toBeNull();
  });
});
