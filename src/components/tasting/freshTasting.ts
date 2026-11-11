import type { TastingData } from '../../types';

/** Everything a fresh tasting starts from. The impression and purchase choice are
 *  state beside the data, so they are reset with it or they carry onto the new record. */
export function freshTastingState(): { tastingData: TastingData; verdict: null; wouldBuy: false } {
  return { tastingData: {}, verdict: null, wouldBuy: false };
}
