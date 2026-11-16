/** Gram shortcuts in the Source form's Buy panel. */
export const BUY_GRAM_CHIPS = [50, 100, 150, 250, 357, 500];

/** What Sample opens the Buy panel with ('flow' form): purpose Sample and the
 *  smallest quantity, one unit for teas bought by the piece (cakes, bricks,
 *  teaware) or the smallest gram shortcut otherwise. Acquisition is left as it
 *  is, and nothing here touches a price: the quantity is the same one the
 *  smallest chip would set. */
export function samplePreset(unitBased: boolean): { purpose: 'sample'; quantity: number } {
  return { purpose: 'sample', quantity: unitBased ? 1 : BUY_GRAM_CHIPS[0] };
}
