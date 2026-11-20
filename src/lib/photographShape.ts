// Every family photograph is shown in one of three shapes and no other:
// square, upright (2:3) or across (3:2). Square is what a photograph gets
// unless its author picks another from the zoom. The stored file keeps what
// the camera gave; the shape is only a crop at the moment of showing.

import type { CSSProperties } from 'react';
import { isFamilyPhotographShape, type FamilyPhotographFrame, type FamilyPhotographShape } from './familyContract';

export type PhotographShape = FamilyPhotographShape;

/** The words on the three buttons in the zoom, in the order they are shown. */
export const PHOTOGRAPH_SHAPE_CHOICES: ReadonlyArray<{ shape: PhotographShape; label: string; says: string }> = [
  { shape: 'square', label: 'Square', says: 'Show square' },
  { shape: 'upright', label: '2:3', says: 'Show upright, two by three' },
  { shape: 'across', label: '3:2', says: 'Show across, three by two' },
];

/** Whatever is stored, the answer is one of the three; anything else is square. */
export function photographShape(stored: unknown): PhotographShape {
  return isFamilyPhotographShape(stored) ? stored : 'square';
}

/** The editor speaks in proportions; the record keeps the shape's name. */
export function shapeOfAspect(aspect: number | undefined): PhotographShape {
  if (aspect === 2 / 3) return 'upright';
  if (aspect === 3 / 2) return 'across';
  return 'square';
}
export function aspectOfShape(shape: PhotographShape): number {
  return shape === 'upright' ? 2 / 3 : shape === 'across' ? 3 / 2 : 1;
}

export interface FramedPicture {
  /** A box between the shape and the picture, needed only when the picture is turned. */
  stage?: CSSProperties;
  picture: CSSProperties;
}

/**
 * Where the picture sits inside its shaped box so that only the framed part
 * shows. Nothing for an unframed photograph: that one is centred by the box.
 * A turned picture is placed inside a stage the size of its turned outline,
 * because the framed part is measured against that outline.
 */
export function framedPicture(frame: FamilyPhotographFrame | null | undefined, width: number, height: number): FramedPicture | undefined {
  const area = frame?.area;
  if (!area || !(area.width > 0) || !(area.height > 0)) return undefined;
  const placed: CSSProperties = {
    position: 'absolute',
    left: `${(-area.x / area.width) * 100}%`,
    top: `${(-area.y / area.height) * 100}%`,
    inlineSize: `${10000 / area.width}%`,
    blockSize: `${10000 / area.height}%`,
  };
  const still: CSSProperties = { maxWidth: 'none', objectFit: 'fill', aspectRatio: 'auto' };
  const turn = frame?.rotation ?? 0;
  if (!turn || !(width > 0) || !(height > 0)) return { picture: { ...placed, ...still } };
  const radians = (turn * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
  const outlineWidth = width * cos + height * sin;
  const outlineHeight = width * sin + height * cos;
  return {
    stage: placed,
    picture: {
      position: 'absolute', left: '50%', top: '50%',
      inlineSize: `${(width / outlineWidth) * 100}%`,
      blockSize: `${(height / outlineHeight) * 100}%`,
      transform: `translate(-50%, -50%) rotate(${turn}deg)`,
      ...still,
    },
  };
}
