import React, { useState, useEffect, useRef } from 'react';

type Status = 'online' | 'offline' | 'back-online';

export const NetworkStatus: React.FC = () => {
  const [status, setStatus] = useState<Status>('online');
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const goOffline = () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setStatus('offline');
    };

    const goOnline = () => {
      setStatus('back-online');
      dismissTimer.current = setTimeout(() => {
        setStatus('online');
      }, 3000);
    };

    // Check initial state
    if (!navigator.onLine) {
      setStatus('offline');
    }

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (status === 'online') return null;

  const isOffline = status === 'offline';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-toast flex items-center justify-center gap-2 px-4 py-2.5 text-xs tracking-wide border-b transition-all duration-500 ease-out ${
        isOffline
          ? 'bg-tea-surface border-tea-border text-tea-text-sec'
          : 'bg-tea-accent-sub border-tea-border text-tea-gold'
      }`}
      style={{
        animation: 'networkSlideDown 0.4s ease-out forwards',
      }}
    >
      {isOffline ? (
        <>
          <svg
            className="w-4 h-4 text-tea-gold shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>You're offline — some content may be unavailable</span>
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 text-tea-gold shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Back online</span>
        </>
      )}
    </div>
  );
};
