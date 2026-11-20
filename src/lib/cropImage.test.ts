import { describe, expect, it } from 'vitest';
import { framedOutputSize } from './cropImage';
import { photoFrameSize } from './photoFrameGeometry';

describe('the saved picture keeps the frame\'s shape', () => {
  it('keeps the three shapes exactly as they were', () => {
    expect(framedOutputSize(1600, 1)).toEqual({ width: 1600, height: 1600 });
    expect(framedOutputSize(1600, 3 / 2)).toEqual({ width: 1599, height: 1066 });
    expect(framedOutputSize(1600, 2 / 3)).toEqual({ width: 1066, height: 1599 });
  });
  it('frames a story frame to its own proportions, long edge at the output size', () => {
    expect(framedOutputSize(1600, 4 / 5)).toEqual({ width: 1280, height: 1600 });
    expect(framedOutputSize(1600, 16 / 9)).toEqual({ width: 1600, height: 900 });
  });
  it('falls back to square on a shape that is not a number', () => {
    expect(framedOutputSize(800, Number.NaN)).toEqual({ width: 800, height: 800 });
  });
  it('the editor draws a 4:5 frame inside the photograph', () => {
    const frame = photoFrameSize({ mediaWidth: 480, mediaHeight: 320, viewportWidth: 480, viewportHeight: 480 }, 0, 4 / 5);
    expect(frame.height).toBe(320);
    expect(frame.width).toBeCloseTo(256);
  });
});
