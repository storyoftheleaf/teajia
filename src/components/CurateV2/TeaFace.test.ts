import { describe, expect, it } from 'vitest';
import { fromLine } from './TeaFace';

describe('fromLine', () => {
  it('says year, place, type and form in that order, skipping what is missing', () => {
    expect(fromLine({ year: 2019, originRegion: 'Yiwu', type: 'Sheng Puer' as any, form: 'Cake' as any })).toBe('2019 · Yiwu · Sheng Puer · Cake');
    expect(fromLine({ originCountry: 'Taiwan' })).toBe('Taiwan');
    expect(fromLine({})).toBe('');
  });
});
