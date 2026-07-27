import { useState, useEffect, useCallback } from 'react';

interface TiltValues {
  rotateX: number;
  rotateY: number;
}

export function useGyroscopeTilt(): TiltValues {
  const [tilt, setTilt] = useState<TiltValues>({ rotateX: 0, rotateY: 0 });

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;
    setTilt({
      rotateX: clamp(beta * 0.06, -3, 3),
      rotateY: clamp(gamma * 0.06, -3, 3),
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('DeviceOrientationEvent' in window)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      // iOS 13+, silently try on first user interaction
      const tryPermission = async () => {
        try {
          const result = await DOE.requestPermission();
          if (result === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        } catch { /* denied or unavailable */ }
        document.removeEventListener('touchstart', tryPermission, { capture: true });
      };
      document.addEventListener('touchstart', tryPermission, { once: true, capture: true });
      return () => document.removeEventListener('touchstart', tryPermission, { capture: true } as EventListenerOptions);
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  return tilt;
}
