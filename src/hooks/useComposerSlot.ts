import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../lib/store';

/**
 * Register a composer slot for the duration of the calling component's lifetime.
 *
 * When active, BottomTabBar replaces its left/right nav items with the supplied
 * nodes — the centered teajiā logo stays put. Tapping the logo "peeks" the
 * normal nav back in so the user can navigate away.
 *
 * Pass stable (memoized) ReactNodes to avoid re-rendering BottomTabBar on every
 * parent render. Pass null to temporarily suspend the slot without unmounting.
 */
export function useComposerSlot(slot: { left?: ReactNode; right?: ReactNode } | null) {
  const setComposerSlot = useAppStore((s) => s.setComposerSlot);
  useEffect(() => {
    setComposerSlot(slot);
    return () => setComposerSlot(null);
  }, [slot, setComposerSlot]);
}
