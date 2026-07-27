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

/** Crossfades route content on path change. */
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children }) => {
  const location = useLocation();

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Keyed motion.div without AnimatePresence, when the key changes React
  // unmounts/remounts and `animate` runs from `initial`. AnimatePresence with
  // mode="wait" was getting stuck when leaving pages with heavy internal
  // animations (the homepage scroll reveal), leaving the new page at opacity 0.
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
};
