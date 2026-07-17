import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NETWORK_ERROR_EVENT,
  NETWORK_RECOVERED_EVENT,
  type NetworkErrorKind,
} from '../../lib/api';

const NETWORK_MESSAGES: Record<NetworkErrorKind, string> = {
  offline: "You're offline. Reconnect to keep going.",
  unstable: 'Connection is unstable. Retrying.',
  slow: 'The server is taking too long. Retrying.',
};

export const NetworkErrorNotice = () => {
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<NetworkErrorKind>('unstable');

  useEffect(() => {
    const handleNetworkError = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: NetworkErrorKind }>).detail;
      setKind(detail?.kind ?? 'unstable');
      setVisible(true);
    };
    const handleNetworkRecovered = () => setVisible(false);

    window.addEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
    window.addEventListener(NETWORK_RECOVERED_EVENT, handleNetworkRecovered);
    return () => {
      window.removeEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
      window.removeEventListener(NETWORK_RECOVERED_EVENT, handleNetworkRecovered);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          aria-live="polite"
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-toast flex items-center justify-center gap-2 px-4 py-2.5 text-xs tracking-wide border-b bg-tea-surface border-tea-border text-tea-text-sec"
        >
          <svg className="w-4 h-4 text-tea-text-dim shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>{NETWORK_MESSAGES[kind]}</span>
          <button
            onClick={() => setVisible(false)}
            className="tap-target ml-2 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
