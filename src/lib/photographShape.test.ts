import { describe, expect, it } from 'vitest';
import { photographShape } from './photographShape';

describe('the three shapes', () => {
  it('reads a landscape file as across, a portrait file as upright, and the rest as square', () => {
    expect(photographShape(2000, 1333)).toBe('across');
    expect(photographShape(1333, 2000)).toBe('upright');
    expect(photographShape(1000, 1000)).toBe('square');
    expect(photographShape(1200, 1000)).toBe('square');
    expect(photographShape(1000, 1200)).toBe('square');
  });
  it('never answers anything but one of the three, whatever it is given', () => {
    for (const [w, h] of [[0, 0], [NaN, 5], [5, -1], [10000, 1], [1, 10000]] as const) {
      expect(['square', 'upright', 'across']).toContain(photographShape(w, h));
    }
    expect(photographShape(null, undefined)).toBe('square');
  });
});
