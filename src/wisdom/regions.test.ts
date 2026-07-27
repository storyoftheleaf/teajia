import { describe, expect, it } from 'vitest';
import { countryForRegion, findRegion, REGIONS } from './regions';

describe('findRegion', () => {
  it('resolves a canonical name and a county written the long way', () => {
    expect(findRegion('Guangxi')).toMatchObject({ country: 'China' });
    expect(findRegion('Alishan')).toMatchObject({ country: 'Taiwan' });
    expect(findRegion('Anji')).toMatchObject({ country: 'China' });
  });

  it('resolves the short forms a vendor actually writes', () => {
    // A Dan Cong invoice says Phoenix, not Phoenix Mountain.
    expect(findRegion('Phoenix')?.name).toBe('Phoenix Mountain');
    expect(findRegion('Wuyishan')?.name).toBe('Wuyi');
    expect(findRegion('Dongding')?.name).toBe('Dong Ding');
  });

  it('returns nothing for a place we do not hold', () => {
    expect(findRegion('Nowhere In Particular')).toBeNull();
    expect(findRegion('')).toBeNull();
  });
});

describe('countryForRegion', () => {
  it('answers from the region alone', () => {
    expect(countryForRegion('Alishan')).toBe('Taiwan');
    expect(countryForRegion('Phoenix')).toBe('China');
    expect(countryForRegion('Nowhere')).toBeNull();
  });
});

describe('REGIONS', () => {
  it('holds every place once, with a country', () => {
    expect(REGIONS.length).toBeGreaterThan(150);
    expect(REGIONS.every(region => region.country)).toBe(true);
    expect(new Set(REGIONS.map(r => r.id)).size).toBe(REGIONS.length);
  });
});
