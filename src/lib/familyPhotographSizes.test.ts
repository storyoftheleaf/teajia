import { describe, expect, it } from 'vitest';
import { familyPhotographSizes, fitWithin } from './familyPhotographSizes';
import { FAMILY_FULL_LONG_EDGE, FAMILY_SMALL_LONG_EDGE } from './familyContract';

describe('the two copies of a family photograph', () => {
  it('brings a 12 megapixel phone picture down to the door limits on its long edge, keeping its shape', () => {
    const { full, small } = familyPhotographSizes(4032, 3024);
    expect(full).toEqual({ width: FAMILY_FULL_LONG_EDGE, height: 1500 });
    expect(small).toEqual({ width: FAMILY_SMALL_LONG_EDGE, height: 360 });
  });

  it('measures a portrait picture by its height', () => {
    expect(familyPhotographSizes(3024, 4032).full).toEqual({ width: 1500, height: FAMILY_FULL_LONG_EDGE });
  });

  it('never enlarges a picture that is already small', () => {
    expect(fitWithin(300, 200, FAMILY_FULL_LONG_EDGE)).toEqual({ width: 300, height: 200 });
  });

  it('refuses a picture with no size', () => {
    expect(() => fitWithin(0, 0, 100)).toThrow();
  });
});
