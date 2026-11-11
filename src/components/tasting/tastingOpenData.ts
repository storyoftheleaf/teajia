import type { TastingData } from '../../types';

/**
 * What the full tasting opens with for a Curate tea: its current tasting, else the
 * most recent history record. Without it the tasting opens blank and saving then
 * replaces what was recorded.
 */
export function tastingToOpenWith(entry: {
  tasting?: TastingData | null;
  tastingHistory?: ReadonlyArray<{ data: TastingData; date?: string }> | null;
}): TastingData | undefined {
  return entry.tasting ?? entry.tastingHistory?.at(-1)?.data;
}
