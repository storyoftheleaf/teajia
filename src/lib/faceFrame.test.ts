import { describe, expect, it } from 'vitest';
import { faceFramePercent, faceFramePixels } from './faceFrame';

describe('faceFramePercent', () => {
  const natural = { width: 1290, height: 1273 };
  const face = { x: 816, y: 311, width: 234, height: 234 };

  it('frames head and shoulders around the face, inside the photo', () => {
    const area = faceFramePercent(face, natural, 1);
    const px = faceFramePixels(face, natural, 1);
    expect(px.width).toBe(px.height);
    expect(px.width).toBeGreaterThan(face.width * 2);
    expect(px.x).toBeLessThanOrEqual(face.x);
    expect(px.x + px.width).toBeGreaterThanOrEqual(face.x + face.width);
    expect(px.y).toBeLessThanOrEqual(face.y);
    expect(area.x + area.width).toBeLessThanOrEqual(100.0001);
    expect(area.y + area.height).toBeLessThanOrEqual(100.0001);
  });

  it('keeps the frame inside the photo when the face is at an edge', () => {
    const px = faceFramePixels({ x: 1200, y: 0, width: 90, height: 90 }, natural, 1);
    expect(px.x + px.width).toBeLessThanOrEqual(natural.width);
    expect(px.y).toBe(0);
  });

  it('gives the whole photo when the face already fills it', () => {
    const area = faceFramePercent({ x: 0, y: 0, width: 1000, height: 1000 }, { width: 1000, height: 1000 }, 1);
    expect(area).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('keeps the frame shape asked for', () => {
    const px = faceFramePixels(face, natural, 2 / 3);
    expect(px.width / px.height).toBeCloseTo(2 / 3, 1);
  });
});
