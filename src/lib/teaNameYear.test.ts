import { describe, expect, it } from 'vitest';
import { splitNameYear } from './teaNameYear';
import { normalizeProduct } from './storefrontApi';

describe('splitNameYear', () => {
  it('lifts a leading year that matches the record', () => {
    expect(splitNameYear('1990 Bamboo Leaf Old Tea', 1990)).toEqual({ name: 'Bamboo Leaf Old Tea', year: '1990' });
  });

  it('fills an empty year box from the name', () => {
    expect(splitNameYear('1993 Y562', null)).toEqual({ name: 'Y562', year: '1993' });
    expect(splitNameYear('Large Basket Liu Bao 1990s', '')).toEqual({ name: 'Large Basket Liu Bao', year: '1990s' });
  });

  it('keeps the name as typed when the two years disagree', () => {
    expect(splitNameYear('2004 Yiwu Raw Puerh', 2008)).toEqual({ name: '2004 Yiwu Raw Puerh', year: '2008' });
  });

  it('lifts a short decade only when the record names its century', () => {
    expect(splitNameYear('80s Ginseng Puer', '1980s')).toEqual({ name: 'Ginseng Puer', year: '1980s' });
    expect(splitNameYear('80s Ginseng Puer', null)).toEqual({ name: '80s Ginseng Puer', year: '' });
  });

  it('never empties a name that is only a year', () => {
    expect(splitNameYear('2004', null)).toEqual({ name: '2004', year: '' });
  });

  it('leaves names without a year alone, including numbers that are not years', () => {
    expect(splitNameYear('Naka Gushu', null)).toEqual({ name: 'Naka Gushu', year: '' });
    expect(splitNameYear('Tieguanyin 8888', null)).toEqual({ name: 'Tieguanyin 8888', year: '' });
  });
});

describe('normalizeProduct', () => {
  it('leaves teaware names alone, since an antique date is part of the piece', () => {
    const p = normalizeProduct({ id: 'w', type: 'Teaware', product_name: '1970s Gold-Painted Porcelain Pieces', given_name: '', year: null });
    expect(p.productName).toBe('1970s Gold-Painted Porcelain Pieces');
  });

  it('reads the name without its year on every public surface', () => {
    const p = normalizeProduct({ id: 'a', product_name: '1990 Bamboo Leaf Old Tea', given_name: '', year: 1990 });
    expect(p.productName).toBe('Bamboo Leaf Old Tea');
    expect(String(p.year)).toBe('1990');
  });

  it('strips the given name too, and fills the year from it', () => {
    const p = normalizeProduct({ id: 'b', product_name: 'Y562', given_name: '1993 Y562', year: null });
    expect(p.givenName).toBe('Y562');
    expect(String(p.year)).toBe('1993');
  });
});
