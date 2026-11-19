/** Displayed, unrotated photo size and the square editor's available space. */
export interface FrameBounds {
  mediaWidth: number;
  mediaHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

type Point = { x: number; y: number };

function validBounds(bounds: FrameBounds) {
  return [bounds.mediaWidth, bounds.mediaHeight, bounds.viewportWidth, bounds.viewportHeight]
    .every(value => Number.isFinite(value) && value > 0);
}

function rotationAxes(degrees: number) {
  const radians = (Number.isFinite(degrees) ? degrees % 360 : 0) * Math.PI / 180;
  // Exact quarter turns avoid tiny floating point pan offsets at 90°/180°.
  const snap = (value: number) => Math.abs(value) < 1e-12 ? 0 : Math.abs(1 - Math.abs(value)) < 1e-12 ? Math.sign(value) : value;
  return { cos: snap(Math.cos(radians)), sin: snap(Math.sin(radians)) };
}

/** Shrink the square focus area instead of introducing blank rotated corners. */
export function squareFrameSize(bounds: FrameBounds, rotationDegrees: number): number {
  if (!validBounds(bounds)) return 0;
  const { cos, sin } = rotationAxes(rotationDegrees);
  return Math.min(bounds.mediaWidth, bounds.mediaHeight, bounds.viewportWidth, bounds.viewportHeight)
    / (Math.abs(cos) + Math.abs(sin));
}

/** Clamp in the photo's own axes so every selected corner stays on the image. */
export function clampPhotoFrameCrop(crop: Point, bounds: FrameBounds, zoom: number, rotation: number): Point {
  const side = squareFrameSize(bounds, rotation);
  if (!side) return { x: 0, y: 0 };
  const { cos, sin } = rotationAxes(rotation);
  const scale = Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
  const x = Number.isFinite(crop.x) ? crop.x : 0;
  const y = Number.isFinite(crop.y) ? crop.y : 0;
  const cornerReach = side / 2 * (Math.abs(cos) + Math.abs(sin));
  const halfWidth = Math.max(0, bounds.mediaWidth / 2 * scale - cornerReach);
  const halfHeight = Math.max(0, bounds.mediaHeight / 2 * scale - cornerReach);
  const clamp = (value: number, margin: number) => Math.max(-margin, Math.min(margin, value));
  const localX = clamp(x * cos + y * sin, halfWidth);
  const localY = clamp(-x * sin + y * cos, halfHeight);
  const result = { x: localX * cos - localY * sin, y: localX * sin + localY * cos };
  return { x: Number.isFinite(result.x) ? result.x : 0, y: Number.isFinite(result.y) ? result.y : 0 };
}
