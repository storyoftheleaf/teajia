import { describe, expect, it } from 'vitest';
import { childrenOf, findCultivarById, matchCultivar, parentsOf } from './cultivars';

const named = (entries: Array<{ name: string } | string>) => entries.map(entry => typeof entry === 'string' ? entry : entry.name);

describe('matchCultivar', () => {
  it('resolves a plant from the tea name written around it', () => {
    expect(matchCultivar('2019 Rou Gui Yancha')).toMatchObject({ name: 'Rou Gui' });
    expect(matchCultivar('house blend', '肉桂')).toMatchObject({ name: 'Rou Gui' });
  });

  it('returns nothing rather than a wrong plant', () => {
    expect(matchCultivar('Unlabelled bag from the market')).toBeNull();
    expect(matchCultivar('')).toBeNull();
  });

  it('will not match an alias that cuts a breeding code in half', () => {
    // "TRES-2022" contains the alias "TRES #20". Resolving it named a
    // different plant as Cui Yu's parent.
    expect(matchCultivar('TRES-2022')).toBeNull();
  });
});

describe('parentsOf', () => {
  it('splits only on a cross operator standing alone', () => {
    // The x inside "Jin Xuan" and "Qing Xin" used to split these apart.
    const chinHsin = findCultivarById('chin-hsin');
    expect(chinHsin?.parentage).toContain('Jin Xuan');
    expect(named(parentsOf(chinHsin!))).toEqual(['Jin Xuan', 'Qing Xin', 'Cui Yu']);
  });

  it('keeps a parent we do not hold as plain text', () => {
    const jinXuan = findCultivarById('jin-xuan');
    expect(named(parentsOf(jinXuan!))).toEqual(['Ying Zhi Hong Xin', 'Tainung #8']);
  });

  it('reads a cross written inside parentheses', () => {
    const baiWen = findCultivarById('bai-wen');
    expect(named(parentsOf(baiWen!))).toEqual(['Qing Xin Da Mao', 'TRES-1407']);
  });

  it('has no parents when none were recorded', () => {
    expect(parentsOf({ id: 'x', name: 'X', altNames: [] })).toEqual([]);
  });
});

describe('childrenOf', () => {
  it('finds plants that name this one as a parent', () => {
    const jinXuan = findCultivarById('jin-xuan');
    expect(named(childrenOf(jinXuan!)).length).toBeGreaterThan(0);
    expect(named(childrenOf(jinXuan!))).not.toContain('Jin Xuan');
  });
});
