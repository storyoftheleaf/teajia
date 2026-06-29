import React, { useState, useEffect } from 'react';
import { useImagePreloader } from '../../context/ImagePreloaderContext';

export const PreloadIndicator: React.FC = () => {
  const { getPreloadState } = useImagePreloader();
  const [visible, setVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Single hide-timer, not a fresh setTimeout every 200ms tick. The old code
    // scheduled a new fade-out on every idle tick, so stale timers could fire
    // mid-load and flicker the bar. Now we arm the hide once and cancel it the
    // moment loading resumes.
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      const count = getPreloadState().pendingUrls.size;
      setPendingCount(count);
      if (count > 0) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        setVisible(true);
      } else if (!hideTimer) {
        hideTimer = setTimeout(() => { setVisible(false); hideTimer = null; }, 800);
      }
    }, 200);
    return () => { clearInterval(interval); if (hideTimer) clearTimeout(hideTimer); };
  }, [getPreloadState]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-sticky h-[2px] transition-opacity duration-500 ${
        pendingCount > 0 ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full bg-tea-gold/70 transition-all duration-300 ease-out"
        style={{
          width: pendingCount > 0 ? '70%' : '100%',
          animation: pendingCount > 0 ? 'preloadSlide 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <style>{`
        @keyframes preloadSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(30%); }
          100% { transform: translateX(100vw); }
        }
      `}</style>
    </div>
  );
};
