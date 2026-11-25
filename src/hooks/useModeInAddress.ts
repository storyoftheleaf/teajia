import { useEffect, useRef } from 'react';

/**
 * Curate's screen (Source, Library, Buying) and the address, kept in step.
 *
 * The address to the screen: when `routeMode` changes (a browser back or
 * forward, or a link), the screen follows. The screen to the address: a screen
 * change made inside Curate calls `onModeChange`, which the route turns into a
 * new history entry. That direction runs only when `mode` itself changes, so a
 * browser back (address first, then the screen) never writes the old screen
 * back over the one being returned to. Adrian, 2026-11-25: back did nothing.
 */
export function useModeInAddress<M extends string>(
  mode: M,
  setMode: (mode: M) => void,
  routeMode: M,
  onModeChange?: (mode: M) => void,
) {
  useEffect(() => {
    setMode(routeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode]);

  const routeModeRef = useRef(routeMode);
  routeModeRef.current = routeMode;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  useEffect(() => {
    if (mode !== routeModeRef.current) onModeChangeRef.current?.(mode);
  }, [mode]);
}
