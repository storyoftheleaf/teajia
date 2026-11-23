import { describe, expect, it } from 'vitest';
import { GENERATED_DRAFT_CLAIMS } from '../reference/generatedDraftClaims';
import type { PublicClaim } from '../reference/claims';
import { ageBand, composeInputs, entryProblems, yearOf } from './composeInputs';

const claims = GENERATED_DRAFT_CLAIMS.map(claim => ({ ...claim, text: claim.pendingText ?? claim.text })) as unknown as PublicClaim[];
const naka = { id: 'dddd11d2-7357-4d91-86e8-52a99bb47c51', product_name: 'Naka Gushu', type: 'Shou Puer', form: 'Cake', year: null, origin_region: 'Mengsong, Menghai, Yunnan', origin_country: 'China' };
const brick = { id: 'brick', product_name: 'Ripe Puerh Brick', type: 'Shou Puer', form: 'Brick', year: 1990, origin_region: 'Yunnan', origin_country: 'China', terroir: 'This brick rested in Guangzhou’s tea trade.' };
const ids = (list?: PublicClaim[]) => (list ?? []).map(claim => claim.claimId);

describe('composeInputs', () => {
  it('reads years and decades', () => {
    expect(yearOf(1990)).toEqual({ label: '1990', year: 1990 });
    expect(yearOf('1980s')).toEqual({ label: 'the 1980s', year: 1985 });
    expect(yearOf('')).toBeNull();
    expect([ageBand(2), ageBand(7), ageBand(36)]).toEqual(['age-young', 'age-settling', 'age-aged']);
  });

  it('gives Naka its place and type, no age and no notice', () => {
    const inputs = composeInputs(naka, claims, { thisYear: 2026, noNotice: [naka.id] });
    expect(ids(inputs.layers.place)).toContain('menghai-county:mengsong-naka');
    expect(ids(inputs.layers.type)).toEqual(['shou:definition', 'shou:wet-piling']);
    expect(inputs.layers.age).toBeUndefined();
    expect(inputs.fixed.notice).toBeUndefined();
    expect(inputs.fixed.brewing?.text).toMatch(/^From a cake, brick or tuo/);
    expect(inputs.missing[0]).toMatch(/year/);
  });

  it('gives a thin 1990 brick the aged band and brewing, and reads no place from Yunnan alone', () => {
    const inputs = composeInputs(brick, claims, { thisYear: 2026 });
    expect(inputs.record.ageYears).toBe(36);
    expect(ids(inputs.layers.age)).toEqual(['shou:age-aged']);
    expect(inputs.fixed.claimIds).toEqual(['shou:brewing-pressed', 'shou:brewing', 'shou:notice-aged']);
    expect(inputs.fixed.notice?.styleName).toBe('aged ripe pu’er');
    const loose = composeInputs({ ...brick, form: 'Loose Leaf', year: 2022 }, claims, { thisYear: 2026 });
    expect(loose.fixed.brewing?.text).not.toMatch(/pick/);
    expect(loose.fixed.notice?.styleName).toBe('ripe pu’er');
    expect(inputs.layers.place).toBeUndefined();
    expect(inputs.record.notes).toEqual([brick.terroir]);
  });

  it('flags dashes, foreign links, taste in the story and invented numbers', () => {
    const inputs = composeInputs(brick, claims, { thisYear: 2026 });
    const problems = entryProblems({
      productId: 'brick', missing: [],
      paragraphs: [{ layer: 'age', text: 'A [ripe](sheng:definition) brick — sweet and pressed in 1991.' }],
    }, inputs).map(problem => problem.problem);
    expect(problems).toEqual(expect.arrayContaining([
      'links sheng:definition, which was not supplied', 'uses a dash; the house style has none', 'taste word "sweet" belongs in the notice', 'the number 1991 is in no input',
    ]));
    expect(entryProblems({ productId: 'brick', missing: [], paragraphs: [{ layer: 'lot', text: 'A brick from 1990.' }], notice: { layer: 'notice', styleName: 'aged ripe pu’er', text: 'People often find it smooth.' } }, inputs)
      .map(problem => problem.problem)).toContain('the notice speaks of this lot ("it", "this"); describe the style instead');
    expect(entryProblems({ productId: 'brick', missing: [], paragraphs: [{ layer: 'lot', text: 'A [ripe pu’er](shou:definition) brick from 1990, kept in Guangzhou.' }] }, inputs)).toEqual([]);
  });
});
