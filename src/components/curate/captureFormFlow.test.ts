import { describe, expect, it } from 'vitest';
import { formLayoutFromSearch } from './captureFormLayout';
import { BUY_GRAM_CHIPS, samplePreset } from './samplePreset';

describe('which Source form is shown', () => {
  it('is the flow form by default', () => {
    expect(formLayoutFromSearch('')).toBe('flow');
    expect(formLayoutFromSearch('?tab=sourcing')).toBe('flow');
    expect(formLayoutFromSearch('?tab=sourcing&form=flow')).toBe('flow');
  });

  it('is the classic form only when the address asks for it', () => {
    expect(formLayoutFromSearch('?form=classic')).toBe('classic');
    expect(formLayoutFromSearch('?tab=library&form=classic')).toBe('classic');
    expect(formLayoutFromSearch('?form=Classic')).toBe('flow');
  });
});

describe('Sample in the Buy panel', () => {
  it('asks for a sample of the smallest gram shortcut for loose tea', () => {
    expect(samplePreset(false)).toEqual({ purpose: 'sample', quantity: 50 });
    expect(samplePreset(false).quantity).toBe(Math.min(...BUY_GRAM_CHIPS));
  });

  it('asks for one piece of a tea bought by the piece', () => {
    expect(samplePreset(true)).toEqual({ purpose: 'sample', quantity: 1 });
  });
});
