import { describe, expect, it } from 'vitest';
import { tableFormDefaults } from './tableDefaults';

const place = (is_table: boolean, area_hint: string | null) => ({ id: 'p', name: 'Ubud house', area_hint, is_table });

describe('tableFormDefaults', () => {
  it('starts from six seats, the request door and no area when nothing is known', () => {
    expect(tableFormDefaults(['request', 'link'], undefined, undefined)).toEqual({ seats: 6, door: 'request', area: '' });
  });
  it('takes seats and door from the last table', () => {
    expect(tableFormDefaults(['request', 'link'], { seats: 4, door: 'link' }, [])).toMatchObject({ seats: 4, door: 'link' });
  });
  it('ignores a last door the host may no longer give', () => {
    expect(tableFormDefaults(['request'], { seats: 4, door: 'open' }, [])).toMatchObject({ door: 'request' });
    expect(tableFormDefaults(['link'], { seats: 4, door: null }, [])).toMatchObject({ door: 'link' });
  });
  it('falls back to the last table\'s area when the place has none', () => {
    expect(tableFormDefaults(['request'], { seats: 6, door: 'request', area_hint: 'Canggu' }, [place(true, null)]).area).toBe('Canggu');
  });
  it('takes the area of the place named as the table, not of another place', () => {
    expect(tableFormDefaults(['request'], undefined, [place(false, 'Elsewhere'), place(true, 'Ubud, near the market')]).area)
      .toBe('Ubud, near the market');
    expect(tableFormDefaults(['request'], undefined, [place(true, null)]).area).toBe('');
  });
});
