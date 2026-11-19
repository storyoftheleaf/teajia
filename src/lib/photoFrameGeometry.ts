/** Displayed, unrotated photo size and the photo editor's available space. */
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

/** Fit the selected ratio inside the viewport and the rotated original. */
export function photoFrameSize(bounds: FrameBounds, rotationDegrees: number, aspect = 1): { width: number; height: number } {
  if (!validBounds(bounds)) return { width: 0, height: 0 };
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const { cos, sin } = rotationAxes(rotationDegrees);
  const absCos = Math.abs(cos), absSin = Math.abs(sin);
  const height = Math.min(bounds.viewportHeight, bounds.viewportWidth / ratio,
    bounds.mediaWidth / (ratio * absCos + absSin), bounds.mediaHeight / (ratio * absSin + absCos));
  return { width: height * ratio, height };
}

/** The original square-only API remains available to existing callers. */
export function squareFrameSize(bounds: FrameBounds, rotationDegrees: number): number {
  return photoFrameSize(bounds, rotationDegrees).width;
}

/** Clamp in the photo's own axes so every selected corner stays on the image. */
export function clampPhotoFrameCrop(crop: Point, bounds: FrameBounds, zoom: number, rotation: number, aspect = 1): Point {
  const frame = photoFrameSize(bounds, rotation, aspect);
  if (!frame.width || !frame.height) return { x: 0, y: 0 };
  const { cos, sin } = rotationAxes(rotation);
  const scale = Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
  const x = Number.isFinite(crop.x) ? crop.x : 0;
  const y = Number.isFinite(crop.y) ? crop.y : 0;
  const cornerReachX = (frame.width * Math.abs(cos) + frame.height * Math.abs(sin)) / 2;
  const cornerReachY = (frame.width * Math.abs(sin) + frame.height * Math.abs(cos)) / 2;
  const halfWidth = Math.max(0, bounds.mediaWidth / 2 * scale - cornerReachX);
  const halfHeight = Math.max(0, bounds.mediaHeight / 2 * scale - cornerReachY);
  const clamp = (value: number, margin: number) => Math.max(-margin, Math.min(margin, value));
  const localX = clamp(x * cos + y * sin, halfWidth);
  const localY = clamp(-x * sin + y * cos, halfHeight);
  const result = { x: localX * cos - localY * sin, y: localX * sin + localY * cos };
  return { x: Number.isFinite(result.x) ? result.x : 0, y: Number.isFinite(result.y) ? result.y : 0 };
}
