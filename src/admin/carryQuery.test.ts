import { describe, expect, it } from 'vitest';
import { carryQuery } from './carryQuery';

describe('carryQuery', () => {
  it('carries the incoming query onto a bare target', () => {
    expect(carryQuery('/admin/stock', '?panel=tea-1')).toBe('/admin/stock?panel=tea-1');
  });
  it('adds incoming params beside the target\'s own', () => {
    expect(carryQuery('/admin/activity?tab=orders', '?search=INV-42')).toBe('/admin/activity?tab=orders&search=INV-42');
    expect(carryQuery('/admin/activity?tab=orders', '?draft=abc')).toBe('/admin/activity?tab=orders&draft=abc');
  });
  it('lets the target\'s own param win and never repeats it', () => {
    expect(carryQuery('/admin/activity?tab=orders', '?tab=log&search=x')).toBe('/admin/activity?tab=orders&search=x');
  });
  it('returns the bare path when there is nothing to carry', () => {
    expect(carryQuery('/admin/people', '')).toBe('/admin/people');
    expect(carryQuery('../compass', '')).toBe('../compass');
  });
  it('keeps encoded values intact', () => {
    expect(carryQuery('/admin/stock', '?search=Night%20Palace')).toBe('/admin/stock?search=Night+Palace');
  });
});
