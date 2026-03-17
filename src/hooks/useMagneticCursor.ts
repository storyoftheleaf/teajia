import { useRef, useState, useEffect, useCallback } from 'react';

interface MagneticStyle {
  transform: string;
  transition: string;
}

export function useMagneticCursor(strength: number = 0.3): {
  ref: React.RefObject<HTMLElement>;
  style: React.CSSProperties;
} {
  const ref = useRef<HTMLElement>(null!);
  const [magneticStyle, setMagneticStyle] = useState<MagneticStyle>({
    transform: 'translate(0px, 0px)',
    transition: 'transform 0.2s ease-out',
  });
  const rafRef = useRef<number>(0);
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isTouchDevice.current || !ref.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distX = e.clientX - centerX;
        const distY = e.clientY - centerY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        const threshold = 50;
        const maxShift = 4;

        if (distance < threshold) {
          const factor = (1 - distance / threshold) * strength;
          const shiftX = Math.min(Math.max(distX * factor, -maxShift), maxShift);
          const shiftY = Math.min(Math.max(distY * factor, -maxShift), maxShift);

          setMagneticStyle({
            transform: `translate(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px)`,
            transition: 'transform 0.15s ease-out',
          });
        } else {
          setMagneticStyle({
            transform: 'translate(0px, 0px)',
            transition: 'transform 0.2s ease-out',
          });
        }
      });
    },
    [strength]
  );

  const handleMouseLeave = useCallback(() => {
    setMagneticStyle({
      transform: 'translate(0px, 0px)',
      transition: 'transform 0.2s ease-out',
    });
  }, []);

  useEffect(() => {
    if (isTouchDevice.current) return;

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return { ref, style: magneticStyle };
}
