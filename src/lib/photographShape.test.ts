import { describe, expect, it } from 'vitest';
import { PHOTOGRAPH_SHAPE_CHOICES, photographShape } from './photographShape';

describe('the three shapes', () => {
  it('shows a photograph square unless its author chose another shape', () => {
    expect(photographShape(undefined)).toBe('square');
    expect(photographShape(null)).toBe('square');
    expect(photographShape('')).toBe('square');
    expect(photographShape('panorama')).toBe('square');
  });
  it('keeps the two other shapes when they were chosen', () => {
    expect(photographShape('upright')).toBe('upright');
    expect(photographShape('across')).toBe('across');
    expect(photographShape('square')).toBe('square');
  });
  it('offers exactly the three, square first', () => {
    expect(PHOTOGRAPH_SHAPE_CHOICES.map(c => c.shape)).toEqual(['square', 'upright', 'across']);
  });
});
