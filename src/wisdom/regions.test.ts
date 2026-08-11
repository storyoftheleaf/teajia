import { describe, expect, it } from 'vitest';
import {
  countryForRegion,
  findRegion,
  regionAncestors,
  regionElevationPresentation,
  regionParent,
  regionsWithin,
  REGIONS,
} from './regions';
import type { Region } from './types';

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

  it('holds the evidenced Jinzhai hierarchy explicitly instead of flattening county, prefecture, and province', () => {
    const jinzhai = findRegion("Jinzhai County, Lu'an");

    expect(jinzhai).toMatchObject({
      level: 'county',
      parentId: 'lu-an-city-anhui',
      altitude: undefined,
    });
    expect(regionParent(jinzhai)?.id).toBe('lu-an-city-anhui');
    expect(regionAncestors(jinzhai).map(region => region.id)).toEqual(['china', 'anhui', 'lu-an-city-anhui']);
    expect(regionsWithin(findRegion("Lu'an City, Anhui")).map(region => region.id)).toContain('jinzhai-county-lu-an');
    expect(findRegion("Lu'an")?.level).toBeUndefined();
  });

  it('does not fabricate a parent when an explicit parent id is absent or unresolved', () => {
    const flat: Region = { id: 'flat', name: 'Flat Place', country: 'China', province: 'Anhui' };
    const orphan: Region = {
      id: 'orphan',
      name: 'Orphan Place',
      country: 'China',
      level: 'county',
      parentId: 'not-held',
    };

    expect(regionParent(flat)).toBeNull();
    expect(regionParent(orphan)).toBeNull();
    expect(regionAncestors(orphan)).toEqual([]);
  });

  it('distinguishes tea-growing elevation from whole-place geography and attributes Jinzhai officially', () => {
    const teaGarden: Region = {
      id: 'evidenced-garden',
      name: 'Evidenced Garden',
      country: 'China',
      elevation: { value: '800-1200m', scope: 'tea_growing' },
    };
    const jinzhai = findRegion("Jinzhai County, Lu'an");

    expect(regionElevationPresentation(teaGarden)).toEqual({
      label: 'Tea-growing elevation',
      value: '800-1200m',
    });
    expect(regionElevationPresentation(jinzhai)).toEqual({
      label: 'County elevation',
      value: '59.5-1729.1m',
      note: 'This is the full county range, not a claimed elevation range for its tea gardens.',
      source: {
        label: "Jinzhai County People’s Government · Geographic location",
        url: 'https://www.ahjinzhai.gov.cn/zjjz/dlwz/index.html',
      },
    });
  });
});
