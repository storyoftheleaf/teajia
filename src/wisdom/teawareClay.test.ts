import { describe, expect, it } from 'vitest';
import { stockClayReading } from './teawareClay';

describe('Stock clay reading', () => {
  it.each([
    ['Yixing clay', 'zini (purple clay)', 'english.cnipa.gov.cn'],
    ['Jianshui purple clay', 'Wanyao village', 'www.ihchina.cn'],
    ['Chaozhou clay', 'Fengxi', 'www.ihchina.cn'],
  ])('links the regional material %s to a documented tradition', (material, excerpt, domain) => {
    const reading = stockClayReading({ material });
    expect(reading?.paragraphs.join(' ')).toContain(excerpt);
    expect(reading?.paragraphs[0]).toContain('Teajia lists the clay as ' + material + '.');
    expect(reading?.links?.[0].href).toContain(domain);
  });

  it('separates a regional Stock label, a named clay and an owner confirmation', () => {
    for (const material of ['Clay', 'Rock mine clay', 'White clay', 'Red clay', 'Purple clay', 'Possibly Yixing clay']) {
      expect(stockClayReading({ material })).toBeUndefined();
    }
    expect(stockClayReading({ material: 'Yixing clay', teawareDetails: { is_yixing: false } })).toBeUndefined();
    expect(stockClayReading({ material: 'Chaozhou clay', teawareDetails: { clay_type: '朱泥' } })).toBeUndefined();
    expect(stockClayReading({ material: 'Yixing clay', teawareDetails: { clay_type: 'Possibly Zhuni' } })).toBeUndefined();
    expect(stockClayReading({ material: 'Yixing clay', teawareDetails: { clay_type: '朱泥' } })?.paragraphs[0]).toContain('Gu Jingzhou');
  });

  it('keeps entered clay history intact without crediting an unrelated source for it', () => {
    const reading = stockClayReading({ material: 'Yixing clay', teawareDetails: { clay_type: 'Zini', clay_history: 'Record from this workshop.' } });
    expect(reading?.paragraphs).toEqual(['Teajia lists the clay as Zini.', 'Record from this workshop.']);
    expect(reading?.links).toBeUndefined();
  });
});
