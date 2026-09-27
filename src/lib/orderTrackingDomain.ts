export interface AsyncResultGuard {
  isCurrent: () => boolean;
  cancel: () => void;
}

export function createAsyncResultGuard(): AsyncResultGuard {
  let current = true;
  return {
    isCurrent: () => current,
    cancel: () => { current = false; },
  };
}

export type TrackingResult<T> =
  | { status: 'found'; inquiry: T }
  | { status: 'missing' }
  | { status: 'unavailable' };

/** The API returns null only for 404. A failed connection cannot prove absence. */
export async function loadTrackingRequest<T>(load: () => Promise<T | null>): Promise<TrackingResult<T>> {
  try {
    const inquiry = await load();
    return inquiry === null ? { status: 'missing' } : { status: 'found', inquiry };
  } catch { return { status: 'unavailable' }; }
}

export function trackingItemQuantity(item: { category?: string; quantityGrams?: number; packGrams?: number; packs?: number }): string {
  if (item.category !== 'tea') return `×${item.quantityGrams}`;
  const packs = Number(item.packs);
  const grams = Number(item.packGrams);
  if (Number.isInteger(packs) && packs > 0 && Number.isFinite(grams) && grams > 0) {
    return `${packs > 1 ? `${packs} × ` : ''}${grams}g`;
  }
  return `${item.quantityGrams}g`;
}
