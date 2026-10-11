import { describe, expect, it } from 'vitest';
import { joinItemCode, splitItemCode } from './sampleRows';

describe('item codes', () => {
  it('takes the code off the front of the name, and puts it back on save', () => {
    expect(splitItemCode('LKY-PE1 Palace Pu Erh Tea')).toEqual({ code: 'LKY-PE1', name: 'Palace Pu Erh Tea' });
    expect(joinItemCode('LKY-PE1', 'Palace Puer')).toBe('LKY-PE1 Palace Puer');
  });
  it('leaves an ordinary name alone', () => {
    expect(splitItemCode('1958 Aged Raw')).toEqual({ code: null, name: '1958 Aged Raw' });
    expect(splitItemCode('Da Hong Pao')).toEqual({ code: null, name: 'Da Hong Pao' });
    expect(joinItemCode(null, ' Da Hong Pao ')).toBe('Da Hong Pao');
  });
});
