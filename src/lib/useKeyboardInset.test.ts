import { describe, expect, it } from 'vitest';
import { keyboardCover } from './useKeyboardInset';

describe('keyboardCover', () => {
  it('reads the keyboard as what the visual viewport lost at the bottom', () => {
    expect(keyboardCover(844, { height: 508, offsetTop: 0, scale: 1 })).toBe(336);
  });
  it('subtracts a page that iOS panned up to reach the input', () => {
    expect(keyboardCover(844, { height: 508, offsetTop: 100, scale: 1 })).toBe(236);
  });
  it('ignores the toolbar settling and a pinch zoom', () => {
    expect(keyboardCover(844, { height: 800, offsetTop: 0, scale: 1 })).toBe(0);
    expect(keyboardCover(844, { height: 400, offsetTop: 0, scale: 2 })).toBe(0);
    expect(keyboardCover(844, null)).toBe(0);
  });
});
