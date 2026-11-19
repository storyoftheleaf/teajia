import { describe, expect, it } from 'vitest';
import { todayRange } from './DaySheetButton';
import { scoreWords } from './FeedbackList';

// Teajia family, stage 6: the small pure parts of the Guest notes additions.

describe("today's sheet range", () => {
  it('is the shop\'s own local day, as two instants one day apart', () => {
    const range = todayRange(new Date(2026, 10, 19, 15, 30));
    expect(range.day).toBe('2026-11-19');
    expect(new Date(range.from).getTime()).toBe(new Date(2026, 10, 19).getTime());
    expect(new Date(range.to).getTime()).toBe(new Date(2026, 10, 20).getTime());
  });

  it('rolls over a month end', () => {
    const range = todayRange(new Date(2026, 11, 31, 23, 59));
    expect(range.day).toBe('2026-12-31');
    expect(new Date(range.to).getTime()).toBe(new Date(2027, 0, 1).getTime());
  });
});

describe('how a member\'s score reads to the shop', () => {
  it('names the impression and the rating, and says nothing when there is neither', () => {
    expect(scoreWords({ impression: 'love', rating: 9 })).toBe('Love, 9 of 10');
    expect(scoreWords({ impression: 'pass', rating: null })).toBe('Dislike');
    expect(scoreWords({ impression: null, rating: 0 })).toBe('0 of 10');
    expect(scoreWords({ impression: null, rating: null })).toBeNull();
  });
});
