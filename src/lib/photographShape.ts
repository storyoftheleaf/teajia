// Every family photograph is shown in one of three shapes and no other:
// square, upright (2:3) or across (3:2). Square is what a photograph gets
// unless its author picks another from the zoom. The stored file keeps what
// the camera gave; the shape is only a crop at the moment of showing.

import { isFamilyPhotographShape, type FamilyPhotographShape } from './familyContract';

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
