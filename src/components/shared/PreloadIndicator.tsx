import React, { useState, useEffect } from 'react';
import { useImagePreloader } from '../../context/ImagePreloaderContext';

export const PreloadIndicator: React.FC = () => {
  const { getPreloadState } = useImagePreloader();
  const [visible, setVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = getPreloadState();
      const count = state.pendingUrls.size;
      setPendingCount(count);
      if (count > 0) {
        setVisible(true);
      } else {
        // Fade out after loading finishes
        setTimeout(() => setVisible(false), 800);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [getPreloadState]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[55] h-[2px] transition-opacity duration-500 ${
        pendingCount > 0 ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full bg-tea-seal/70 transition-all duration-300 ease-out"
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
