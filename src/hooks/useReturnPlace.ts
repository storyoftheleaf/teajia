import { useEffect } from 'react';

const KEY = 'teajia.returnPlace';

/**
 * Someone signed out tapped Keep, Save or Taste on a private link and is sent
 * to join. They come back exactly where they were (Adrian, 2026-11-27: "bring
 * them right back to where they were so they don't lose where they were"):
 * the address carries the open tea, and this carries how far down they had
 * scrolled, for this tab only.
 */
export function holdReturnPlace(): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname, y: window.scrollY }));
  } catch { /* they land at the top, which is where the guide is */ }
}

/** Once the page has its teas, put the person back where they left, once. */
export function useReturnPlace(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    try {
      const held = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as { path?: string; y?: number } | null;
      if (!held || held.path !== window.location.pathname) return;
      window.sessionStorage.removeItem(KEY);
      const y = Number(held.y);
      if (y > 0) window.requestAnimationFrame(() => window.scrollTo({ top: y }));
    } catch { /* stay at the top */ }
  }, [ready]);
}
