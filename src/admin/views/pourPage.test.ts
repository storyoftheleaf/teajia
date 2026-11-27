import { describe, expect, it } from 'vitest';
import { addKey, gramsOf, kindsOf, matchesTea, namedKindsFrom, sitForDay, type PourSit, type PourTea } from './pourPage';

const tea = (over: Partial<PourTea>): PourTea => ({
  id: 'x', name: 'A tea', product_name: null, chinese_name: null, type: 'Dark', classification: null, year: null,
  image_url: null, stock_grams: 0, status: 'Active', created_at: null, sample: 0, ...over,
});
const type = (keys: string) => [...keys].reduce((typed, key) => addKey(typed, key === '<' ? 'back' : key), '');

describe('the number pad', () => {
  it('types grams with one decimal place', () => {
    expect(type('7')).toBe('7');
    expect(type('7.5')).toBe('7.5');
    expect(type('7.55')).toBe('7.5');
    expect(type('7..5')).toBe('7.5');
    expect(type('.5')).toBe('0.5');
    expect(type('05')).toBe('5');
    expect(type('12345')).toBe('1234');
    expect(type('12<')).toBe('1');
    expect(type('<')).toBe('');
  });
  it('has a weight to enter only once one is typed', () => {
    expect(gramsOf('')).toBeNull();
    expect(gramsOf('0')).toBeNull();
    expect(gramsOf('0.')).toBeNull();
    expect(gramsOf('7.')).toBe(7);
    expect(gramsOf('7.5')).toBe(7.5);
  });
});

describe('the kinds of tea', () => {
  const named = namedKindsFrom([
    { kind: 'tea_type', label: 'Liu Bao', nativeName: '六堡茶' },
    { kind: 'tea_type', label: 'Wuyi rock tea (yancha)', nativeName: '武夷岩茶' },
    { kind: 'tea_type', label: 'Shou (ripe pu’er)', nativeName: '熟普洱' },
    { kind: 'tea_family', label: 'Dark tea (hei cha)' },
  ]);
  const shelf = [
    tea({ id: 'a', name: 'Malaysian Returned', product_name: 'Malaysian Returned Liu Bao' }),
    tea({ id: 'b', name: 'San He Liu Bao' }),
    tea({ id: 'c', name: 'Bamboo Leaf Old Tea' }),
    tea({ id: 'd', name: 'Meizhan Yancha', type: 'Oolong' }),
    tea({ id: 'e', name: 'Small Tuo', type: 'Shou Puer' }),
    tea({ id: 'f', name: 'Old basket', chinese_name: '六堡茶', type: 'MISSING_TYPE' }),
  ];

  it('offers the types, then the named kinds the Wisdom Base holds, never a kind that repeats a type', () => {
    expect(kindsOf(shelf, named)).toEqual(['Dark', 'Oolong', 'Shou Puer', 'Liu Bao', 'Wuyi rock tea']);
  });
  it('finds Liu Bao by either name and by its Chinese name', () => {
    expect(shelf.filter(one => matchesTea(one, 'Liu Bao', '', named)).map(one => one.id)).toEqual(['a', 'b', 'f']);
    expect(shelf.filter(one => matchesTea(one, 'Dark', '', named)).map(one => one.id)).toEqual(['a', 'b', 'c']);
  });
  it('searches every word, in any name', () => {
    expect(shelf.filter(one => matchesTea(one, '', 'returned bao', named)).map(one => one.id)).toEqual(['a']);
    expect(shelf.filter(one => matchesTea(one, 'Oolong', 'liu', named))).toEqual([]);
  });
});

describe('the sit a pour joins', () => {
  const sit = (over: Partial<PourSit>): PourSit => ({
    id: 's', title: 'Tea', date: '2026-11-27', timezone: 'UTC', casual: true, happened: true, link: null, note: null,
    place: null, has_way: false, way_open: true, teas: [], ...over,
  });
  it('is the one made on the pour page for that day, before a session of that day', () => {
    const sits = [sit({ id: 'proper', casual: false, date: '2026-11-27T06:00:00.000Z' }), sit({ id: 'casual' }), sit({ id: 'old', date: '2026-11-20' })];
    expect(sitForDay(sits, '2026-11-27')?.id).toBe('casual');
    expect(sitForDay(sits.slice(0, 1), '2026-11-27')?.id).toBe('proper');
    expect(sitForDay(sits, '2026-11-26')).toBeNull();
  });
});
