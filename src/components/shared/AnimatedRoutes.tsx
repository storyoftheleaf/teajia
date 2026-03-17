import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { pathToSection } from '../../lib/routes';
import { Section } from '../../types';

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

// Section order used to determine forward vs back direction
const SECTION_ORDER: Section[] = ['HOME', 'MAGAZINE', 'LEARN', 'SHOP', 'OFFERINGS', 'ABOUT'];

const pageVariants = {
  enter: (direction: 'forward' | 'back') => ({
    opacity: 0,
    x: direction === 'forward' ? 60 : -60,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: 'forward' | 'back') => ({
    opacity: 0,
    x: direction === 'forward' ? -60 : 60,
  }),
};

const pageTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

/** Wraps route content with directional slide + crossfade transitions. */
export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children }) => {
  const location = useLocation();

  // Reduce motion support
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const prevPathRef = useRef<string>(location.pathname);
  const directionRef = useRef<'forward' | 'back'>('forward');

  // Determine direction based on section order index comparison
  const currentSection = pathToSection(location.pathname);
  const prevSection = pathToSection(prevPathRef.current);
  const currentIndex = SECTION_ORDER.indexOf(currentSection);
  const prevIndex = SECTION_ORDER.indexOf(prevSection);

  if (prevPathRef.current !== location.pathname) {
    if (currentIndex !== -1 && prevIndex !== -1) {
      directionRef.current = currentIndex >= prevIndex ? 'forward' : 'back';
    } else {
      directionRef.current = 'forward';
    }
    prevPathRef.current = location.pathname;
  }

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" custom={directionRef.current}>
      <motion.div
        key={location.pathname}
        custom={directionRef.current}
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
