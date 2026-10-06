import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NETWORK_ERROR_EVENT,
  NETWORK_RECOVERED_EVENT,
  type NetworkErrorKind,
} from '../../lib/api';

const NETWORK_MESSAGES: Record<NetworkErrorKind, string> = {
  offline: "You're offline. Reconnect to keep going.",
  unstable: "Couldn't load everything. Check your connection.",
  slow: 'This is taking too long. Try again in a moment.',
};

/** A request that fails and recovers inside this window never reaches the screen. */
export const NETWORK_NOTICE_DELAY_MS = 4000;

export const NetworkErrorNotice = () => {
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<NetworkErrorKind>('unstable');
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cancelPending = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
    const handleNetworkError = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: NetworkErrorKind }>).detail;
      const next = detail?.kind ?? 'unstable';
      cancelPending();
      pending.current = setTimeout(() => {
        pending.current = null;
        setKind(next);
        setVisible(true);
      }, NETWORK_NOTICE_DELAY_MS);
    };
    const handleNetworkRecovered = () => {
      cancelPending();
      setVisible(false);
    };

    window.addEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
    window.addEventListener(NETWORK_RECOVERED_EVENT, handleNetworkRecovered);
    return () => {
      window.removeEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
      window.removeEventListener(NETWORK_RECOVERED_EVENT, handleNetworkRecovered);
      cancelPending();
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          aria-live="polite"
          initial={{ x: '-50%', y: 12, opacity: 0 }}
          animate={{ x: '-50%', y: 0, opacity: 1 }}
          exit={{ x: '-50%', y: 12, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed z-toast left-1/2 bottom-nav-gap flex items-center gap-1 pl-4 pr-1 h-8 max-w-[calc(100vw-2rem)] rounded-full bg-tea-elevated text-ui-12 text-tea-text-sec"
        >
          <span className="truncate">{NETWORK_MESSAGES[kind]}</span>
          <button
            onClick={() => setVisible(false)}
            className="tap-target shrink-0 w-7 h-7 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
