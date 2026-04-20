import { useState, useEffect, useRef } from 'react';

interface ScrollDirectionState {
  scrollY: number;
  direction: 'up' | 'down' | 'idle';
  isScrolling: boolean;
  isAtTop: boolean;
  progress: number; // 0-1, how far the header should collapse
}

const COLLAPSE_THRESHOLD = 80; // px of scroll before full collapse

export const useScrollDirection = () => {
  const [state, setState] = useState<ScrollDirectionState>({
    scrollY: 0,
    direction: 'idle',
    isScrolling: false,
    isAtTop: true,
    progress: 0,
  });

  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const direction = currentY > lastScrollY.current ? 'down' : 'up';
      const isAtTop = currentY < 10;
      const progress = Math.min(currentY / COLLAPSE_THRESHOLD, 1);

      setState({
        scrollY: currentY,
        direction,
        isScrolling: true,
        isAtTop,
        progress,
      });

      lastScrollY.current = currentY;

      // Mark scrolling as stopped after 150ms of no scroll
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setState(prev => ({ ...prev, isScrolling: false }));
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return state;
};
