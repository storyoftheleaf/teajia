import { useEffect } from 'react';
import { useAppStore } from '../lib/store';

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

/**
 * Replace the centered teajiā logo in BottomTabBar with a web3-styled mic
 * button while this component is mounted. Pass `null` to opt out (e.g. when
 * the calling screen is in a sub-mode where the mic doesn't apply).
 *
 * Only one screen can claim the slot at a time — last register wins, and the
 * cleanup unsets it on unmount. The hook reads individual fields so React's
 * dep tracking doesn't fire on object identity changes from the parent.
 */
export function useBottomBarMic(opts: { state: RecorderState; onPress: () => void } | null) {
  const setBottomBarAction = useAppStore((s) => s.setBottomBarAction);
  const state = opts?.state;
  const onPress = opts?.onPress;
  useEffect(() => {
    if (!state || !onPress) {
      setBottomBarAction(null);
      return;
    }
    setBottomBarAction({ type: 'mic', state, onPress });
    return () => setBottomBarAction(null);
  }, [state, onPress, setBottomBarAction]);
}
