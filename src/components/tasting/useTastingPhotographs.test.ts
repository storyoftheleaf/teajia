import { describe, expect, it } from 'vitest';
import { FAMILY_PHOTOS_PER_TEA } from '../../lib/familyContract';
import { readMyTea } from './useTastingPhotographs';

// The tasting shows the family's camera, photograph row and Share step only on
// a shop tea, and it learns which teas those are from the worker's answer to
// "my photographs of this tea". An answer in any other shape once reached the
// row as it was and took the whole screen down with it.
describe('the answer for my photographs of a tea', () => {
  it('reads the worker\'s answer', () => {
    const photo = { id: 'p1' };
    expect(readMyTea({ product_id: 't', photographs: [photo], remaining: 5 })).toEqual({ photos: [photo], remaining: 5 });
    expect(readMyTea({ product_id: 't', photographs: [], remaining: 0 })).toEqual({ photos: [], remaining: 0 });
  });

  it('gives the full allowance when the answer does not say how many are left', () => {
    expect(readMyTea({ photographs: [] })).toEqual({ photos: [], remaining: FAMILY_PHOTOS_PER_TEA });
  });

  it('treats anything else as not a shop tea, so nothing of the family shows', () => {
    for (const odd of [undefined, null, {}, [], 'page', 7, { photographs: null }, { photographs: 'none' }, { error: 'This tea is not in the shop.' }]) {
      expect(readMyTea(odd)).toBeNull();
    }
  });
});
