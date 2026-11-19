import { describe, expect, it } from 'vitest';
import { clampPhotoFrameCrop, photoFrameSize, squareFrameSize, type FrameBounds } from './photoFrameGeometry';

const bounds: FrameBounds = { mediaWidth: 480, mediaHeight: 320, viewportWidth: 400, viewportHeight: 400 };

function expectCornersInside(crop: { x: number; y: number }, frame: FrameBounds, zoom: number, angle: number, aspect = 1) {
  const size = photoFrameSize(frame, angle, aspect);
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  for (const x of [-size.width / 2, size.width / 2]) for (const y of [-size.height / 2, size.height / 2]) {
    const localX = (x - crop.x) * cos + (y - crop.y) * sin;
    const localY = -(x - crop.x) * sin + (y - crop.y) * cos;
    expect(Math.abs(localX)).toBeLessThanOrEqual(frame.mediaWidth * zoom / 2 + 1e-7);
    expect(Math.abs(localY)).toBeLessThanOrEqual(frame.mediaHeight * zoom / 2 + 1e-7);
  }
}

describe('square photo focus geometry', () => {
  it('shrinks the centered square at 2° and 3° to keep rotated corners on the photo', () => {
    const zero = squareFrameSize(bounds, 0);
    const two = squareFrameSize(bounds, 2), three = squareFrameSize(bounds, 3);
    expect(zero).toBe(320);
    expect(two).toBeLessThan(zero);
    expect(three).toBeLessThan(two);
    expect(two).toBeCloseTo(320 / (Math.cos(2 * Math.PI / 180) + Math.sin(2 * Math.PI / 180)), 10);
    for (const angle of [2, 3]) expectCornersInside(clampPhotoFrameCrop({ x: 0, y: 0 }, bounds, 1, angle), bounds, 1, angle);
  });

  it('preserves the normal square and valid pan at 0° and fits 90° rotations', () => {
    expect(clampPhotoFrameCrop({ x: 20, y: 0 }, bounds, 1, 0)).toEqual({ x: 20, y: 0 });
    for (const angle of [0, 90, 180, 270, 360, -90]) {
      expect(squareFrameSize(bounds, angle)).toBeCloseTo(320, 10);
      const crop = clampPhotoFrameCrop({ x: 1000, y: -1000 }, bounds, 1, angle);
      expectCornersInside(crop, bounds, 1, angle);
    }
  });

  it('clamps translated edge selections in source axes across zoom, portrait images and negative angles', () => {
    for (const frame of [bounds, { ...bounds, mediaWidth: 220, mediaHeight: 560 }, { ...bounds, viewportWidth: 180, viewportHeight: 280 }]) {
      for (const zoom of [1, 1.5, 3, 4]) for (const angle of [-179, -45, -3, 2, 3, 44, 89, 90, 135, 180, 359]) {
        for (const crop of [{ x: 10000, y: -10000 }, { x: -10000, y: 10000 }, { x: 10000, y: 10000 }, { x: 12, y: 21 }]) {
          const clamped = clampPhotoFrameCrop(crop, frame, zoom, angle);
          expect(Number.isFinite(clamped.x) && Number.isFinite(clamped.y)).toBe(true);
          expectCornersInside(clamped, frame, zoom, angle);
          const reclamped = clampPhotoFrameCrop(clamped, frame, zoom, angle);
          expect(reclamped.x).toBeCloseTo(clamped.x, 8);
          expect(reclamped.y).toBeCloseTo(clamped.y, 8);
        }
      }
    }
  });

  it('returns a finite empty geometry for unloaded or invalid bounds', () => {
    for (const frame of [{ ...bounds, mediaWidth: 0 }, { ...bounds, mediaHeight: -1 }, { ...bounds, viewportWidth: NaN }, { ...bounds, viewportHeight: Infinity }]) {
      expect(squareFrameSize(frame, 3)).toBe(0);
      expect(clampPhotoFrameCrop({ x: 10, y: -10 }, frame, 1, 3)).toEqual({ x: 0, y: 0 });
    }
    expect(squareFrameSize(bounds, NaN)).toBe(320);
    expect(clampPhotoFrameCrop({ x: NaN, y: Infinity }, bounds, NaN, Infinity)).toEqual({ x: 0, y: 0 });
  });
});


it('fits square, portrait and landscape focus presets inside viewport and rotated original during pan', () => {
  for (const aspect of [1, 2 / 3, 3 / 2]) for (const frame of [bounds, { ...bounds, mediaWidth: 220, mediaHeight: 560 }, { ...bounds, viewportWidth: 180, viewportHeight: 280 }]) {
    for (const angle of [-90, -45, -3, 0, 2, 3, 45, 90, 179]) {
      const size = photoFrameSize(frame, angle, aspect);
      expect(size.width / size.height).toBeCloseTo(aspect, 10);
      expect(size.width).toBeLessThanOrEqual(frame.viewportWidth + 1e-7);
      expect(size.height).toBeLessThanOrEqual(frame.viewportHeight + 1e-7);
      for (const zoom of [1, 1.5, 4]) for (const pan of [{ x: 0, y: 0 }, { x: 1e4, y: -1e4 }, { x: -1e4, y: 1e4 }, { x: 1e4, y: 1e4 }]) {
        const crop = clampPhotoFrameCrop(pan, frame, zoom, angle, aspect);
        expectCornersInside(crop, frame, zoom, angle, aspect);
      }
    }
  }
  expect(photoFrameSize(bounds, 0, 3 / 2)).toEqual({ width: 400, height: 400 / 1.5 });
  expect(photoFrameSize({ ...bounds, mediaWidth: 0 }, 3, 2 / 3)).toEqual({ width: 0, height: 0 });
  expect(photoFrameSize(bounds, 0, NaN)).toEqual(photoFrameSize(bounds, 0, 1));
});
