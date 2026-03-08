import { useRef, useState, useEffect } from 'react';

/**
 * Shared IntersectionObserver singleton — all useSectionReveal instances
 * register with the same observer to avoid creating N observers per page.
 */
const callbacks = new Map<Element, (entry: IntersectionObserverEntry) => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = callbacks.get(entry.target);
          if (cb) cb(entry);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
  }
  return sharedObserver;
}

function observe(el: Element, cb: (entry: IntersectionObserverEntry) => void) {
  callbacks.set(el, cb);
  getSharedObserver().observe(el);
}

function unobserve(el: Element) {
  callbacks.delete(el);
  getSharedObserver().unobserve(el);
  // Clean up singleton when no elements remain
  if (callbacks.size === 0 && sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}

/** Check prefers-reduced-motion (cached per session) */
let _prefersReducedMotion: boolean | null = null;
function prefersReducedMotion(): boolean {
  if (_prefersReducedMotion === null) {
    _prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return _prefersReducedMotion;
}

/** Lightweight scroll-reveal hook using a shared IntersectionObserver.
 *  Respects prefers-reduced-motion — instantly visible, no animation. */
export function useSectionReveal() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Immediately reveal if user prefers reduced motion
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    observe(el, (entry) => {
      if (entry.isIntersecting) {
        setVisible(true);
        unobserve(el);
      }
    });

    return () => unobserve(el);
  }, []);

  const noMotion = prefersReducedMotion();

  return {
    ref,
    className: visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    style: noMotion ? undefined : { transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' },
  };
}
