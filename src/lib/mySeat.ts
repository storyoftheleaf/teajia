// A seat answer that still counts as hers on the invite page (review U1-1): it has a page token and is
// not cancelled or denied. The account's answer is tried first; a seat asked for on this device before
// she signed in has no account on it, so the device's own saved answer is read the same way.
export function usableSeat(data: unknown): Record<string, any> | null {
  const seat = (data ?? {}) as Record<string, any>;
  const token = seat.magic_token || seat.magicToken;
  const status = seat.status;
  if (token && status && status !== 'cancelled' && status !== 'denied') return { ...seat, magic_token: token };
  return null;
}
