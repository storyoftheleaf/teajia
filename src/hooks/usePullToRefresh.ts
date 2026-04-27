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

export const usePullToRefresh = (onRefresh?: RefreshFn) => {
  const [state, setState] = useState<PullToRefreshState>({
    pullDistance: 0,
    isRefreshing: false,
    isPulling: false,
  });

  const touchStartY = useRef(0);
  const isAtTop = useRef(false);
  // Hold the latest callback in a ref so handlers don't need to re-bind on every
  // render of the consuming component (refetch fns from React Query are unstable).
  const onRefreshRef = useRef<RefreshFn | undefined>(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isAtTop.current = true;
    } else {
      isAtTop.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isAtTop.current || state.isRefreshing) return;
    if (window.scrollY > 0) {
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
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(state.pullDistance / PULL_THRESHOLD, 1);

  return {
    pullDistance: state.pullDistance,
    isRefreshing: state.isRefreshing,
    isPulling: state.isPulling,
    progress,
  };
};
