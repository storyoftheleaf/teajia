import React from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

const pageVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition: Transition = {
  duration: 0.12,
  ease: 'easeOut',
};

/** Wraps route content with directional slide + crossfade transitions. */
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children }) => {
  const location = useLocation();

  // Reduce motion support
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="enter"
        animate="center"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
