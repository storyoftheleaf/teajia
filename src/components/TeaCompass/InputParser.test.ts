import { describe, expect, it } from 'vitest';
import { parseTeaInput } from './InputParser';

// Baseline tests written against parseTeaInput's current, undocumented
// behaviour, BEFORE it is refactored to read the shared wisdom recognition
// index instead of its own local keyword tables. Every case here must keep
// passing after the refactor; that is how the refactor proves it preserved
// behaviour rather than changed it.
describe('parseTeaInput (current behaviour, preserved across the wisdom refactor)', () => {
  it('returns a blank result for empty input', () => {
    expect(parseTeaInput('')).toEqual({ name: '' });
    expect(parseTeaInput('   ')).toEqual({ name: '' });
  });

  it('extracts a storage phrase and removes it from the name', () => {
    expect(parseTeaInput('2019 Yiwu dry storage sheng cake')).toMatchObject({
      storage: 'Dry', year: 2019, region: 'Yiwu', type: 'Sheng', form: 'Cake',
    });
    expect(parseTeaInput('wet storage brick')).toMatchObject({ storage: 'Wet/Traditional', form: 'Brick' });
    expect(parseTeaInput('hk storage tuo')).toMatchObject({ storage: 'HK', form: 'Tuo' });
  });

  it('extracts multi-word "loose leaf" as the Loose form', () => {
    const result = parseTeaInput('Dan Cong loose leaf');
    expect(result.form).toBe('Loose');
    expect(result.name).toBe('Dan Cong');
  });

  it('extracts a multi-word region ahead of tokenizing', () => {
    expect(parseTeaInput('Dong Ding Oolong 2020')).toMatchObject({ region: 'Dong Ding', type: 'Oolong', year: 2020 });
  });

  it('extracts a single-word region from COMMON_REGIONS', () => {
    expect(parseTeaInput('2019 Yiwu Sheng cake')).toMatchObject({ region: 'Yiwu', year: 2019, type: 'Sheng', form: 'Cake' });
  });

  it('extracts a region supplied via knownRegions, longest match first', () => {
    expect(parseTeaInput('Master Chen private garden tea', ['Master Chen private garden'])).toMatchObject({
      region: 'Master Chen private garden',
    });
  });

  it('extracts a year in range and leaves out-of-range numbers in the name', () => {
    expect(parseTeaInput('2019 cake')).toMatchObject({ year: 2019, form: 'Cake' });
    expect(parseTeaInput('1800 cake').year).toBeUndefined();
    expect(parseTeaInput('1800 cake').name).toBe('1800');
  });

  it('extracts a season by exact case-insensitive match', () => {
    expect(parseTeaInput('spring harvest 2020')).toMatchObject({ season: 'Spring', year: 2020 });
    expect(parseTeaInput('Summer oolong')).toMatchObject({ season: 'Summer', type: 'Oolong' });
  });

  it('extracts a standalone "dry"/"wet" as storage only when safely standalone', () => {
    expect(parseTeaInput('dry')).toMatchObject({ storage: 'Dry' });
    expect(parseTeaInput('wet')).toMatchObject({ storage: 'Wet/Traditional' });
    expect(parseTeaInput('dry 2019')).toMatchObject({ storage: 'Dry', year: 2019 });
    // "dry" immediately followed by "storage" is handled by the phrase pass,
    // not the single-word shortcut, and isn't safely standalone either way.
    expect(parseTeaInput('dry leaf').storage).toBeUndefined();
    expect(parseTeaInput('dry leaf').name).toBe('dry leaf');
  });

  it('resolves known type dialect words', () => {
    expect(parseTeaInput('green tips').type).toBe('Green');
    expect(parseTeaInput('white peony').type).toBe('White');
    expect(parseTeaInput('matcha powder').type).toBe('Green');
    expect(parseTeaInput('black assam').type).toBe('Red');
  });

  it('never resolves a bare puerh spelling to a type', () => {
    const result = parseTeaInput('Puerh cake');
    expect(result.type).toBeUndefined();
    expect(result.form).toBe('Cake');
    expect(result.name).toBe('Puerh');
  });

  it("keeps 'Red' followed by a name word as part of the tea name, not the type", () => {
    const result = parseTeaInput('Red Robe tea');
    expect(result.type).toBeUndefined();
    expect(result.name).toBe('Red Robe tea');
  });

  it('resolves bare "Red" normally when not followed by a name word', () => {
    expect(parseTeaInput('Red 2019').type).toBe('Red');
    expect(parseTeaInput('Red').type).toBe('Red');
  });

  it('resolves a single-word form', () => {
    expect(parseTeaInput('cake 2019').form).toBe('Cake');
    expect(parseTeaInput('ball tea').form).toBe('Ball');
  });

  it('rebuilds the name from whatever tokens were not consumed, collapsing whitespace', () => {
    const result = parseTeaInput('  2019   Yiwu   Sheng   Old Tree   Cake  ');
    expect(result.name).toBe('Old Tree');
    expect(result).toMatchObject({ year: 2019, region: 'Yiwu', type: 'Sheng', form: 'Cake' });
  });

  it('never strips generic English words the shared wisdom vocabulary also recognises as a dialect word, since they are legitimate tea-name words too', () => {
    // The wisdom base's normalizeTeaForm answers "leaf" -> Loose and "pearl"
    // -> Ball; a free-text parser must not therefore eat these words out of
    // "Jasmine Pearl" or a Big Leaf varietal name.
    expect(parseTeaInput('Jasmine Pearl')).toEqual({ name: 'Jasmine Pearl' });
    expect(parseTeaInput('Big Leaf Assamica')).toEqual({ name: 'Big Leaf Assamica' });
    // Likewise normalizeTeaType answers "flower" -> Herbal, but "flower" is an
    // ordinary descriptive word in plenty of non-herbal tea names, and a scented
    // oolong should still resolve to Oolong from its own "oolong" token, not
    // to Herbal from "flower".
    expect(parseTeaInput('Osmanthus Flower Oolong').type).toBe('Oolong');
  });

  it('leaves unrecognised free text entirely as the name', () => {
    const result = parseTeaInput('Grandmother\'s Special Blend');
    expect(result).toEqual({ name: "Grandmother's Special Blend" });
  });
});
