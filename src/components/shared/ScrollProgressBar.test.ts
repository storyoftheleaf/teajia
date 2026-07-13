import { describe, expect, it } from 'vitest';

import { shouldShowGlobalScrollProgress } from './ScrollProgressBar';

describe('shouldShowGlobalScrollProgress', () => {
  it('hides the global progress bar on the Read index and Read articles', () => {
    expect(shouldShowGlobalScrollProgress('/read')).toBe(false);
    expect(shouldShowGlobalScrollProgress('/read/quiet-hours')).toBe(false);
  });

  it('keeps the global progress bar on ordinary app routes', () => {
    expect(shouldShowGlobalScrollProgress('/shop')).toBe(true);
    expect(shouldShowGlobalScrollProgress('/article/quiet-hours')).toBe(true);
  });
});
