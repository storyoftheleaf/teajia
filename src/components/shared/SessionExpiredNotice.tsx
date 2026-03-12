import { useState, useEffect, useRef } from 'react';
import { SESSION_EXPIRED_EVENT } from '../../lib/api';

/**
 * Non-blocking notification shown when a 401 response indicates
 * the JWT session has expired. Slides down from the top and auto-dismisses.
 * Does not redirect — just informs the user.
 */
export const SessionExpiredNotice = () => {
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleExpired = () => {
      // Avoid stacking multiple notifications
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setVisible(true);
      dismissTimer.current = setTimeout(() => {
        setVisible(false);
      }, 6000);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-toast flex items-center justify-center gap-2 px-4 py-2.5 text-xs tracking-wide border-b transition-transform duration-500 ease-out bg-tea-surface border-tea-border text-tea-text-sec ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <svg
        className="w-4 h-4 text-tea-gold shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>Session expired. Please sign in again.</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-2 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
