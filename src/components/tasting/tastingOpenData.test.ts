import { describe, expect, it } from 'vitest';
import type { TastingData } from '../../types';
import { tastingToOpenWith } from './tastingOpenData';

const tasted: TastingData = { quality: 7, impression: 'like' };
const earlier: TastingData = { quality: 5 };

describe('tasting opened from a Curate v2 card or panel', () => {
  it('opens with the tea\'s current tasting', () => {
    expect(tastingToOpenWith({ tasting: tasted, tastingHistory: [{ data: earlier, date: 'a' }] })).toBe(tasted);
  });
  it('falls back to the most recent history record, so it does not open blank', () => {
    const later: TastingData = { quality: 9 };
    expect(tastingToOpenWith({ tastingHistory: [{ data: earlier, date: 'a' }, { data: later, date: 'b' }] })).toBe(later);
  });
  it('is undefined for a tea never tasted', () => {
    expect(tastingToOpenWith({})).toBeUndefined();
    expect(tastingToOpenWith({ tasting: undefined, tastingHistory: [] })).toBeUndefined();
  });
});
