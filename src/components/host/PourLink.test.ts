import { describe, expect, it } from 'vitest';
import { pourDay, pourPath } from './PourLink';

describe('the way to the pour page', () => {
  it('reads the table\'s day on the table\'s own clock', () => {
    expect(pourDay('2026-11-27T18:30:00Z', 'Asia/Makassar')).toBe('2026-11-28');
    expect(pourDay('2026-11-27T18:30:00Z', 'America/Los_Angeles')).toBe('2026-11-27');
  });

  it('answers nothing for a day it cannot read', () => {
    expect(pourDay('soon', null)).toBeNull();
  });

  it('carries the day and the tea space in the address', () => {
    expect(pourPath({ day: '2026-11-28' })).toBe('/admin/pour?day=2026-11-28');
    expect(pourPath({ placeId: 'place 1' })).toBe('/admin/pour?place=place+1');
    expect(pourPath({})).toBe('/admin/pour');
  });
});
