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
      if (y > 0) return settleAt(y);
    } catch { /* stay at the top */ }
  }, [ready]);
}

/**
 * The page is still filling in below the teas when they arrive (pictures, the
 * pay sheet), so a single scroll stops short at the page's height of the
 * moment. Scroll again as the page grows, for a few seconds at most, and stop
 * the moment the person touches or scrolls themselves.
 */
function settleAt(y: number): () => void {
  let done = false;
  const stop = () => {
    done = true;
    observer?.disconnect();
    window.clearTimeout(timer);
    for (const type of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(type, stop);
  };
  const go = () => {
    if (done) return;
    window.scrollTo({ top: y });
    if (Math.abs(window.scrollY - y) < 2) stop();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(go);
  observer?.observe(document.body);
  const timer = window.setTimeout(stop, 3000);
  for (const type of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(type, stop, { passive: true });
  window.requestAnimationFrame(go);
  return stop;
}
