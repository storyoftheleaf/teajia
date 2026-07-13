import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export const shouldShowGlobalScrollProgress = (pathname: string) =>
  pathname !== '/read' && !pathname.startsWith('/read/');

/** Thin gold progress bar fixed at the top of the viewport. */
export const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      className="fixed top-[env(safe-area-inset-top)] left-0 right-0 h-[2px] bg-tea-gold/80 origin-left z-priority"
      style={{ scaleX }}
    />
  );
};
