import { useState, useRef, useCallback, useEffect } from 'react';

interface PullToRefreshState {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;
const RESISTANCE = 0.4;

type RefreshFn = () => void | Promise<void>;

interface PullToRefreshOptions {
  // When false, the hook binds no touch listeners at all. Used to switch
  // pull-to-refresh OFF on the immersive Read long-reads, where the gesture
  // was being mistaken for a normal downward read-scroll and triggering a
  // full refresh instead of letting the article scroll.
  enabled?: boolean;
}

/** Walk up from the touch target to the element that will actually consume a
 *  downward drag. The old check looked ONLY at window.scrollY, but the admin
 *  shell is a fixed-height layout (`h-screen overflow-hidden`) where the
 *  document NEVER scrolls, so window.scrollY was always 0 and every drag
 *  inside an internal list (Compass Library, inventory, …) armed the pull
 *  gesture: the emblem circle appeared mid-screen and hung for up to 4s of
 *  forced refetch. Now a pull only arms when the nearest scrollable ancestor
 *  is genuinely at its top. */
function pullConsumer(target: EventTarget | null): { el: Element | null; atTop: boolean } {
  let el = target instanceof Element ? target : null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1) {
      return { el, atTop: el.scrollTop <= 0 };
    }
    el = el.parentElement;
  }
  return { el: null, atTop: window.scrollY <= 0 };
}

export const usePullToRefresh = (onRefresh?: RefreshFn, options: PullToRefreshOptions = {}) => {
  const { enabled = true } = options;
  const [state, setState] = useState<PullToRefreshState>({
    pullDistance: 0,
    isRefreshing: false,
    isPulling: false,
  });

  const touchStartY = useRef(0);
  const isAtTop = useRef(false);
  // The scroll container that owns the current gesture (null = document).
  const scrollerRef = useRef<Element | null>(null);
  // Hold the latest callback in a ref so handlers don't need to re-bind on every
  // render of the consuming component (refetch fns from React Query are unstable).
  const onRefreshRef = useRef<RefreshFn | undefined>(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const { el, atTop } = pullConsumer(e.target);
    scrollerRef.current = el;
    if (atTop) {
      touchStartY.current = e.touches[0].clientY;
      isAtTop.current = true;
    } else {
      isAtTop.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isAtTop.current || state.isRefreshing) return;
    const scrolled = scrollerRef.current
      ? scrollerRef.current.scrollTop > 0
      : window.scrollY > 0;
    if (scrolled) {
      isAtTop.current = false;
      setState(prev => ({ ...prev, pullDistance: 0, isPulling: false }));
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      const distance = Math.min(diff * RESISTANCE, MAX_PULL);
      setState(prev => ({ ...prev, pullDistance: distance, isPulling: true }));
    }
  }, [state.isRefreshing]);

  const finish = useCallback(() => {
    setState({ pullDistance: 0, isRefreshing: false, isPulling: false });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!state.isPulling) return;

    if (state.pullDistance >= PULL_THRESHOLD) {
      setState(prev => ({ ...prev, isRefreshing: true, pullDistance: PULL_THRESHOLD * 0.6 }));
      const cb = onRefreshRef.current;
      const minDuration = new Promise<void>(resolve => setTimeout(resolve, 600));
      const refresh = (() => {
        try {
          const ret = cb ? cb() : undefined;
          return ret instanceof Promise ? ret : Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      })();
      // Resolve indicator only after refresh AND a short minimum so the user
      // perceives the action. Cap total at 4s in case a query hangs.
      const timeout = new Promise<void>(resolve => setTimeout(resolve, 4000));
      Promise.race([Promise.all([refresh, minDuration]), timeout]).finally(finish);
    } else {
      finish();
    }
  }, [state.isPulling, state.pullDistance, finish]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(state.pullDistance / PULL_THRESHOLD, 1);

  return {
    pullDistance: state.pullDistance,
    isRefreshing: state.isRefreshing,
    isPulling: state.isPulling,
    progress,
  };
};
