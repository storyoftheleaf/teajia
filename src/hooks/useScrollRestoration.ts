import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Saves and restores scroll position via sessionStorage.
 *
 * Two modes:
 * - Container mode (default): attach the returned `containerRef` to a
 *   scrollable `<div>` (e.g. one with `overflow-y-auto`).
 * - Window mode: pass `{ useWindow: true }` when the page scrolls on the
 *   body/window (no explicit overflow-y container).
 */
export function useScrollRestoration(key?: string, options?: { useWindow?: boolean }) {
  const { pathname } = useLocation();
  const storageKey = key ?? `scroll-${pathname}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const useWindow = options?.useWindow ?? false;

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    const savedPos = saved ? parseInt(saved, 10) : 0;

    if (useWindow) {
      if (savedPos > 0) {
        // rAF ensures the route content has painted before we scroll
        requestAnimationFrame(() => window.scrollTo(0, savedPos));
      }
      return () => {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      };
    }

    if (savedPos > 0 && containerRef.current) {
      containerRef.current.scrollTop = savedPos;
    }
    return () => {
      if (containerRef.current) {
        sessionStorage.setItem(storageKey, String(containerRef.current.scrollTop));
      }
    };
  }, [storageKey, useWindow]);

  return containerRef;
}
