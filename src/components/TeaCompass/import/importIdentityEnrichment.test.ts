import { describe, expect, it } from 'vitest';
import { enrichImportIdentity, vocabularyOptions, type ImportIdentityFields } from './importIdentityEnrichment';
import { matchTeaVariety } from '../../../data/teaVarieties';
import { matchCultivar } from '../../../wisdom';

const blankDraft = (overrides: Partial<ImportIdentityFields> = {}): ImportIdentityFields => ({
  english_name: '', original_name: '', chinese_name: '', tea_type: '', year: '', form: '', origin_country: '', origin: '', cultivar: '',
  ...overrides,
});

describe('matchTeaVariety', () => {
  it('prefers the longest matching alias', () => {
    expect(matchTeaVariety('Aged Liu Bao Tea')).toMatchObject({ name: 'Aged Liu Bao', type: 'Dark', region: 'Guangxi', country: 'China' });
    expect(matchTeaVariety('Liu Bao')).toMatchObject({ name: 'Liu Bao', type: 'Dark' });
  });

  it('matches the Chinese name when the English name is unfamiliar', () => {
    expect(matchTeaVariety('House aged dark tea', '陈年六堡茶')).toMatchObject({ name: 'Aged Liu Bao', type: 'Dark' });
  });

  it('returns null rather than guessing', () => {
    expect(matchTeaVariety('Unlabelled bag from the market')).toBeNull();
    expect(matchTeaVariety('')).toBeNull();
  });
});

describe('enrichImportIdentity', () => {
  it('fills type, origin and Chinese name for a recognised tea', () => {
    expect(enrichImportIdentity(blankDraft({ english_name: 'Aged Liu Bao Tea' }), 'tea')).toEqual({
      tea_type: 'Dark', chinese_name: '陈年六堡', origin: 'Guangxi', origin_country: 'China',
    });
  });

  it('names the plant when the tea is made from a known cultivar', () => {
    const fills = enrichImportIdentity(blankDraft({ english_name: '2019 Rou Gui Yancha' }), 'tea');
    expect(fills.cultivar).toBe('Rou Gui');
    expect(fills.tea_type).toBe('Oolong');
    expect(fills.year).toBe('2019');
  });

  it('leaves the plant alone once the operator has named one', () => {
    const fills = enrichImportIdentity(blankDraft({ english_name: 'Rou Gui', cultivar: 'Shui Xian' }), 'tea');
    expect(fills.cultivar).toBeUndefined();
  });

  it('never overwrites a value the record already carries', () => {
    const fills = enrichImportIdentity(blankDraft({
      english_name: 'Aged Liu Bao Tea', chinese_name: '陈年六堡茶', tea_type: 'Shou', origin: 'Wuzhou',
    }), 'tea');
    expect(fills).toEqual({ origin_country: 'China' });
  });

  it('reads year and form out of the name', () => {
    const fills = enrichImportIdentity(blankDraft({ english_name: '2008 Yiwu Raw Puerh Cake' }), 'tea');
    expect(fills).toMatchObject({ year: '2008', form: 'Cake' });
  });

  it('derives the country from a region the vendor supplied', () => {
    expect(enrichImportIdentity(blankDraft({ english_name: 'Unknown tea', origin: 'Alishan' }), 'tea'))
      .toEqual({ origin_country: 'Taiwan' });
  });

  it('derives the country from a region the operator types before the tea has a name', () => {
    expect(enrichImportIdentity(blankDraft({ origin: 'Alishan' }), 'tea')).toEqual({ origin_country: 'Taiwan' });
  });

  it('leaves the region-derived country alone once the operator has set one', () => {
    const fills = enrichImportIdentity(blankDraft({ origin: 'Alishan', origin_country: 'Some other place' }), 'tea');
    expect(fills.origin_country).toBeUndefined();
  });

  it('returns nothing when the draft has neither a name nor a region', () => {
    expect(enrichImportIdentity(blankDraft(), 'tea')).toEqual({});
  });

  it('leaves teaware alone', () => {
    expect(enrichImportIdentity(blankDraft({ english_name: 'Aged Liu Bao Tea' }), 'teaware')).toEqual({});
  });
});

describe('matchCultivar', () => {
  it('resolves a written tea name to the plant it is made from', () => {
    expect(matchCultivar('2019 Rou Gui Yancha')).toMatchObject({ name: 'Rou Gui' });
    expect(matchCultivar('Cui Yu high mountain oolong')).toMatchObject({ name: 'Cui Yu', parentage: expect.stringContaining('Tainung') });
  });

  it('returns nothing rather than a wrong lineage', () => {
    expect(matchCultivar('Unlabelled bag from the market')).toBeNull();
  });
});

describe('vocabularyOptions', () => {
  it('keeps an off-vocabulary value so a select cannot silently drop it', () => {
    expect(vocabularyOptions(['Green', 'Dark'], 'pu_er')).toEqual(['Green', 'Dark', 'pu_er']);
    expect(vocabularyOptions(['Green', 'Dark'], 'Dark')).toEqual(['Green', 'Dark']);
  });
});
