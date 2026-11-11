import { describe, expect, it } from 'vitest';
import { renderedRowIds, shiftRangeIds } from './selectionRange';

const p = (id: string) => ({ id });
// Flat sorted order is a1 b1 a2 b2 a3, but rows are drawn grouped: A then B.
const flat = [p('a1'), p('b1'), p('a2'), p('b2'), p('a3')];
const groups = [
  { key: 'A', items: [p('a1'), p('a2'), p('a3')] },
  { key: 'B', items: [p('b1'), p('b2')] },
];

describe('shift range follows the drawn order', () => {
  it('uses group order, not the flat order', () => {
    const r = renderedRowIds(groups, new Set(), flat);
    expect(r).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
    expect(shiftRangeIds(r, 'a2', 'b1')).toEqual(['a2', 'a3', 'b1']);
    expect(shiftRangeIds(r, 'b1', 'a2')).toEqual(['a2', 'a3', 'b1']);
  });
  it('never includes rows of a collapsed group', () => {
    const r = renderedRowIds(groups, new Set(['A']), flat);
    expect(r).toEqual(['b1', 'b2']);
    expect(shiftRangeIds(r, 'b1', 'b2')).toEqual(['b1', 'b2']);
  });
  it('skips a collapsed group in the middle of a range', () => {
    const three = [...groups, { key: 'C', items: [p('c1')] }];
    const r = renderedRowIds(three, new Set(['B']), flat);
    expect(shiftRangeIds(r, 'a1', 'c1')).toEqual(['a1', 'a2', 'a3', 'c1']);
  });
  it('falls back to the target alone when the anchor is hidden or absent', () => {
    const r = renderedRowIds(groups, new Set(['A']), flat);
    expect(shiftRangeIds(r, 'a1', 'b2')).toEqual(['b2']);
    expect(shiftRangeIds(r, null, 'b2')).toEqual(['b2']);
  });
  it('uses the flat list when there are no groups', () => {
    expect(renderedRowIds(null, new Set(), flat)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });
});
