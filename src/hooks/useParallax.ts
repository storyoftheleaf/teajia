import { useEffect, useRef, useState } from 'react';

interface ParallaxState {
  offset: number;
  isVisible: boolean;
}

export const useParallax = (speed = 0.03) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ParallaxState>({ offset: 0, isVisible: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setState(prev => ({ ...prev, isVisible: entry.isIntersecting }));
      },
      { threshold: 0 }
    );

    observer.observe(element);

    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distanceFromCenter = elementCenter - viewportCenter;
      setState(prev => ({
        ...prev,
        offset: distanceFromCenter * speed,
      }));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [speed]);

  return { ref, ...state };
};
