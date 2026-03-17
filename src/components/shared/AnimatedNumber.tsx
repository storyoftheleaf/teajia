import React, { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, useMotionValue } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 0.6,
  format = (n) => Math.round(n).toString(),
}) => {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });
  const display = useTransform(springValue, (current) => format(current));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = latest;
      }
    });
    return unsubscribe;
  }, [display]);

  return <motion.span ref={ref}>{format(value)}</motion.span>;
};
