import { describe, expect, it } from 'vitest';
import { YOUR_TABLE_PLACE_OPEN, yourTableLine, yourTablePlaceOpen } from './yourTablePlace';

describe('Add your table (Launch 4, K4)', () => {
  it('is closed until Adrian opens it, and an explicit setting wins', () => {
    expect(YOUR_TABLE_PLACE_OPEN).toBe(false);
    expect(yourTablePlaceOpen({ YOUR_TABLE_PLACE_OPEN: 'true' })).toBe(true);
    expect(yourTablePlaceOpen({ YOUR_TABLE_PLACE_OPEN: 'false' })).toBe(false);
  });

  it('describes a session at a table by whose table and the area, and nothing more', () => {
    expect(yourTableLine({ area: 'Ubud, near the market' }, 'Ana')).toBe('Ana’s table, Ubud, near the market');
    expect(yourTableLine({ area: null }, 'Ana')).toBe('Ana’s table');
    expect(yourTableLine({ area: 'Ubud' })).toBe('The host’s table, Ubud');
    expect(yourTableLine(undefined, 'Ana')).toBeUndefined();
  });
});
