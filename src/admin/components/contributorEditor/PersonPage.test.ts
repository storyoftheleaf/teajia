import { describe, expect, it } from 'vitest';
import { tidyLinks } from './PersonPage';

describe('tidyLinks', () => {
  it('gives a website typed without https:// a full address, and leaves the rest as typed', () => {
    expect(tidyLinks([
      { platform: 'website', value: ' adrianrasmussen.com ' },
      { platform: 'website', value: 'https://teajia.com' },
      { platform: 'instagram', value: '@technicianofthesacred' },
      { platform: 'wechat', value: 'yan_jinwen' },
    ]).map(link => link.value)).toEqual([
      'https://adrianrasmussen.com',
      'https://teajia.com',
      '@technicianofthesacred',
      'yan_jinwen',
    ]);
  });
});
