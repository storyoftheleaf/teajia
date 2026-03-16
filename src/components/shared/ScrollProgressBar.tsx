import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

/** Thin gold progress bar fixed at the top of the viewport. */
export const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-tea-gold/80 origin-left z-[60]"
      style={{ scaleX }}
    />
  );
};
