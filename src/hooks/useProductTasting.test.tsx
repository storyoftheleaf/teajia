import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../types';
import { useProductTasting, type ResolvedTasting } from './useProductTasting';

function resolve(item: Pick<InventoryItem, 'type' | 'tasting' | 'tastingSource'>): ResolvedTasting | null {
  let result: ResolvedTasting | null = null;
  function Probe() {
    result = useProductTasting(item);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}

describe('product tasting resolution', () => {
  it('keeps exact-lot source tasting distinct from legacy common tasting', () => {
    expect(resolve({ type: 'Sheng', tasting: { flavor: ['honey'] }, tastingSource: 'source' })).toEqual({
      tasting: { flavor: ['honey'] },
      source: 'source',
    });
    expect(resolve({ type: 'Sheng', tasting: { flavor: ['honey'] }, tastingSource: 'common' })).toEqual({
      tasting: { flavor: ['honey'] },
      source: 'common',
    });
  });
});
