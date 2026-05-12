import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Status = 'online' | 'offline' | 'back-online';

export const NetworkStatus = () => {
  const [status, setStatus] = useState<Status>('online');
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const goOffline = () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setStatus('offline');
      setVisible(true);
    };

    const goOnline = () => {
      setStatus('back-online');
      setVisible(true);
      dismissTimer.current = setTimeout(() => {
        setVisible(false);
      }, 3000);
    };

    // Check initial state
    if (!navigator.onLine) {
      setStatus('offline');
      setVisible(true);
    }

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const isOffline = status === 'offline';
  const show = visible && status !== 'online';

  return (
    <AnimatePresence
      onExitComplete={() => {
        if (status === 'back-online') setStatus('online');
      }}
    >
      {show && (
        <motion.div
          key={status}
          role="alert"
          aria-live="polite"
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-toast flex items-center justify-center gap-2 px-4 py-2.5 text-xs tracking-wide ${
            isOffline
              ? 'bg-tea-error/15 text-tea-error'
              : 'bg-tea-leaf/80 text-tea-leaf'
          }`}
        >
          {isOffline ? (
            <>
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span>You're offline -- some content may be unavailable</span>
            </>
          ) : (
            <>
              <motion.svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ duration: 0.4 }}
              >
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </motion.svg>
              <span>Back online</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
