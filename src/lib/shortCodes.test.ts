import { describe, expect, it } from 'vitest';
import { matchesShortCode, parseShortCode, teaShortCode } from './shortCodes';

describe('short codes', () => {
  it('writes a tea code from its vendor code and number', () => {
    expect(teaShortCode('V1', 12)).toBe('V1T12');
    expect(teaShortCode('hw9', 3)).toBe('HW9T3');
    expect(teaShortCode(null, 3)).toBeNull();
    expect(teaShortCode('V1', null)).toBeNull();
  });

  it('reads the ways a code is said or typed', () => {
    expect(parseShortCode('V1T12')).toEqual({ vendor: 'V1', tea: 12 });
    expect(parseShortCode(' v1 t12 ')).toEqual({ vendor: 'V1', tea: 12 });
    expect(parseShortCode('V1-T12')).toEqual({ vendor: 'V1', tea: 12 });
    expect(parseShortCode('V3')).toEqual({ vendor: 'V3', tea: null });
    expect(parseShortCode('HW9T3')).toEqual({ vendor: 'HW9', tea: 3 });
  });

  it('leaves ordinary searches alone', () => {
    for (const text of ['yiwu', 'Huang Wei', '2019', 'T12', '']) expect(parseShortCode(text)).toBeNull();
  });

  it('matches a vendor alone or one tea', () => {
    expect(matchesShortCode({ vendor: 'V1', tea: 12 }, 'v1', 12)).toBe(true);
    expect(matchesShortCode({ vendor: 'V1', tea: 12 }, 'V1', 2)).toBe(false);
    expect(matchesShortCode({ vendor: 'V1', tea: null }, 'V1', 7)).toBe(true);
    expect(matchesShortCode({ vendor: 'V1', tea: null }, 'V2', 7)).toBe(false);
  });
});
