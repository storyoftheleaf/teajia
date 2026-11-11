import { describe, expect, it } from 'vitest';
import { freshTastingState } from './freshTasting';

describe('Begin new tasting', () => {
  it('starts with no data, no impression and no purchase choice carried over', () => {
    expect(freshTastingState()).toEqual({ tastingData: {}, verdict: null, wouldBuy: false });
  });
  it('gives a new data object each time', () => {
    expect(freshTastingState().tastingData).not.toBe(freshTastingState().tastingData);
  });
});
