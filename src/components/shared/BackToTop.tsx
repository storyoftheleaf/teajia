import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Floating back-to-top button — minimal gold line aesthetic. */
export const BackToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-[calc(44px+env(safe-area-inset-bottom,0px)+1.5rem)] lg:bottom-8 right-4 lg:right-6 z-40 flex flex-col items-center gap-1 group cursor-pointer bg-transparent border-none p-2"
          aria-label="Back to top"
        >
          {/* Thin upward arrow */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-tea-gold/50 group-hover:text-tea-gold/80 transition-colors duration-300"
          >
            <path
              d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-ui-8 tracking-[0.2em] uppercase text-tea-text-dim/50 group-hover:text-tea-text-dim/80 transition-colors duration-300"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            top
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
