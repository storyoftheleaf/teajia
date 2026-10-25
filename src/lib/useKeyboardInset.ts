import { useEffect, useState } from 'react';
import type React from 'react';

// iOS Safari does not shrink the page when the keyboard opens: it slides the
// keyboard OVER it, so anything fixed to the bottom (the phone Stock sheet,
// where the count is typed) sits underneath the keys and cannot be reached.
// The visual viewport is the one thing that does know how much the keyboard
// covers, so a bottom sheet reads it and lifts itself by exactly that.

/** Below this, the difference is Safari's own toolbar settling, not a keyboard. */
const KEYBOARD_MIN_PX = 80;

/** Pixels of the layout viewport the on-screen keyboard is covering, or 0. */
export function keyboardCover(
  innerHeight: number,
  viewport: { height: number; offsetTop: number; scale: number } | null | undefined,
): number {
  if (!viewport) return 0;
  // Pinching to zoom also shrinks the visual viewport; that is not a keyboard.
  if (viewport.scale > 1.01) return 0;
  const covered = innerHeight - viewport.height - viewport.offsetTop;
  return covered > KEYBOARD_MIN_PX ? Math.round(covered) : 0;
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const read = () => setInset(keyboardCover(window.innerHeight, vv));
    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    return () => {
      vv.removeEventListener('resize', read);
      vv.removeEventListener('scroll', read);
    };
  }, []);
  return inset;
}

/**
 * Style for a `.sheet-behind-nav` sheet: with the keyboard up it sits on top of
 * the keys, and drops the bottom bar's clearance, since the keyboard is covering
 * the bar too.
 */
export function useSheetAboveKeyboard(): React.CSSProperties | undefined {
  const inset = useKeyboardInset();
  return inset > 0 ? { bottom: inset, paddingBottom: 8 } : undefined;
}
