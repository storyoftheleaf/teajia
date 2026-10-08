import { describe, expect, it } from 'vitest';
import { kindLine, placeLine, quotedGrams } from './TeaFace';

describe('the tea screen lines', () => {
  it('says the kind beside the name, and the place on its own line', () => {
    expect(kindLine({ type: 'Sheng' as any, year: 2019 })).toBe('Sheng · 2019');
    expect(kindLine({})).toBe('');
    expect(placeLine({ originRegion: 'Yiwu', originCountry: 'China' })).toBe('Yiwu, China');
    expect(placeLine({ originCountry: 'Taiwan' })).toBe('Taiwan');
  });

  it('prices a cake at its usual 357 g until a weight is entered, and says so', () => {
    expect(quotedGrams({ form: 'Cake' as any })).toEqual({ grams: 357, assumed: true });
    expect(quotedGrams({ form: 'Cake' as any, pricePerUnitGrams: 200 })).toEqual({ grams: 200, assumed: false });
    expect(quotedGrams({ form: 'Loose' as any })).toBeNull();
  });
});
