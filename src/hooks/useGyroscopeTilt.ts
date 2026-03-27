import { useState, useEffect, useCallback } from 'react';

interface TiltValues {
  rotateX: number;
  rotateY: number;
}

export function useGyroscopeTilt(): TiltValues & { requestPermission: () => void; needsPermission: boolean } {
  const [tilt, setTilt] = useState<TiltValues>({ rotateX: 0, rotateY: 0 });
  const [needsPermission, setNeedsPermission] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

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
      setNeedsPermission(true);
      return;
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  useEffect(() => {
    if (!permissionGranted) return;
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [permissionGranted, handleOrientation]);

  const requestPermission = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result === 'granted') {
          setNeedsPermission(false);
          setPermissionGranted(true);
        }
      } catch {
        // Permission denied or unavailable
      }
    }
  }, []);

  return { ...tilt, requestPermission, needsPermission };
}
