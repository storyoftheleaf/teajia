import React from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useLocation, type Location } from 'react-router-dom';

interface AnimatedRoutesProps {
  children: React.ReactNode;
  /**
   * The location the inner <Routes> actually render (defaults to the router
   * location). App.tsx passes the background location while a product modal
   * is open so the crossfade keys off the page underneath — otherwise opening
   * the modal would remount the shop and destroy its scroll/filter state.
   */
  location?: Location;
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
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children, location: locationProp }) => {
  const routerLocation = useLocation();
  const location = locationProp ?? routerLocation;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Keyed motion.div without AnimatePresence — when the key changes React
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
