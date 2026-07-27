import { describe, expect, it } from 'vitest';
import { MARKS, PRODUCERS, findProducerById, marksOf, matchMark, matchProducer, matchStyle } from './producers';

describe('matchProducer', () => {
  it('finds the factory named inside a tea name', () => {
    expect(matchProducer('7572 Menghai')).toMatchObject({ name: 'Menghai Tea Factory' });
    expect(matchProducer('Xiaguan Wild 2005')).toMatchObject({ name: 'Xiaguan Tea Factory' });
  });

  it('finds a producer written only in Chinese', () => {
    expect(matchProducer('Liao Fu Wild', '廖福野生茶')).toMatchObject({ name: 'Liao Fu' });
    expect(matchProducer('Zhong Cha Pai Yuan', '中茶牌圆茶')).toMatchObject({ kind: 'brand' });
  });

  it('says nothing about a tea the shop named itself', () => {
    // Courage is Adrian's own name for a loose sheng. It is not an entry here
    // and must never be forced into one.
    expect(matchProducer('Courage', '勇气')).toBeNull();
    expect(matchProducer('True Love', '真爱')).toBeNull();
  });
});

describe('matchStyle and matchMark', () => {
  it('reads the way a tea was made', () => {
    expect(matchStyle('Xiao Qing Gan', '小青柑')).toMatchObject({ name: 'Xiao Qing Gan' });
    expect(matchStyle('Qi Zi Bing', '七子饼熟茶')).toBeTruthy();
  });

  it('reads the line a tea belongs to', () => {
    expect(matchMark('7572 Menghai')).toMatchObject({ name: '7572' });
    expect(matchMark('Red Seal Camphor Puerh 1980', '紅印樟香普洱')).toBeTruthy();
  });

  it('will not read a recipe number out of a longer number', () => {
    expect(matchMark('batch 175720 of the season')).toBeNull();
  });
});

describe('the holdings themselves', () => {
  it('never invents a founding year', () => {
    expect(PRODUCERS.every(p => p.founded === undefined || (p.founded > 1500 && p.founded <= 2100))).toBe(true);
  });

  it('only links a mark to a producer we actually hold', () => {
    for (const mark of MARKS) {
      if (mark.producerId) expect(findProducerById(mark.producerId)).not.toBeNull();
    }
  });

  it('lists the lines a producer is known for', () => {
    const menghai = findProducerById('menghai-tea-factory');
    expect(marksOf(menghai!).map(m => m.name)).toContain('7572');
  });
});
