import React, { useRef, useCallback } from 'react';

interface LongPressOptions {
  delay?: number;
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
}

export const useLongPress = ({ delay = 500, onLongPress, onClick }: LongPressOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isLongPress = useRef(false);
  const isMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Prevent iOS from triggering text selection / callout on long press
    if ('touches' in e) {
      e.preventDefault();
    }
    isLongPress.current = false;
    isMoved.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };

    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(15);
      onLongPress(e);
    }, delay);
  }, [delay, onLongPress]);

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (isMoved.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const distance = Math.sqrt(
      Math.pow(clientX - startPos.current.x, 2) +
      Math.pow(clientY - startPos.current.y, 2)
    );
    // Cancel if finger moved more than 8px (scrolling, not tapping)
    if (distance > 8) {
      isMoved.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, []);

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isLongPress.current && !isMoved.current && onClick) {
      onClick(e);
    }
  }, [onClick]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
  };
};
