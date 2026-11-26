// A random key this browser keeps for one session (Launch 2, slice H5). It is
// sent with a seat request, so a second tap from the same browser finds the
// seat the first one took instead of taking another. It is not a secret the
// guest needs to know about, and the site works without storage: a private
// window gets a fresh key each time the form opens.

const KEY_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;
const storageName = (slug: string) => `teajia_seat_key_${slug}`;

function freshKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function seatKeyFor(slug: string): string {
  try {
    const kept = localStorage.getItem(storageName(slug));
    if (kept && KEY_PATTERN.test(kept)) return kept;
  } catch { /* private mode */ }
  const key = freshKey();
  try { localStorage.setItem(storageName(slug), key); } catch { /* private mode */ }
  return key;
}

/** After a guest gives up their seat, a new request is a new seat. */
export function forgetSeatKey(slug: string): void {
  try { localStorage.removeItem(storageName(slug)); } catch { /* private mode */ }
}
