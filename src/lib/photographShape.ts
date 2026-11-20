// Every family photograph is shown in one of three shapes and no other:
// square, upright (2:3) or across (3:2). The stored file keeps what the camera
// gave; the shape is a crop at the moment of showing, picked from the file's
// own proportions so the crop takes as little as it can.

export type PhotographShape = 'square' | 'upright' | 'across';

/** Width over height for each shape. */
export const PHOTOGRAPH_SHAPE_RATIO: Record<PhotographShape, number> = {
  square: 1,
  upright: 2 / 3,
  across: 3 / 2,
};

/**
 * The nearest of the three shapes. The cut points sit halfway (in ratio terms)
 * between neighbours: below 0.82 is upright, above 1.22 is across.
 */
export function photographShape(width: number | null | undefined, height: number | null | undefined): PhotographShape {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 'square';
  const ratio = w / h;
  if (ratio < 0.82) return 'upright';
  if (ratio > 1.22) return 'across';
  return 'square';
}
