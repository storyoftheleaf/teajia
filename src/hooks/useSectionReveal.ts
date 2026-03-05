import { useRef, useState, useEffect } from 'react';

/** Lightweight scroll-reveal hook using IntersectionObserver */
export function useSectionReveal() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4', style: { transition: 'opacity 0.6s ease-out, transform 0.6s ease-out' } };
}
