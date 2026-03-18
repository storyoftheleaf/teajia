import React, { useEffect, useState } from 'react';

interface BlobConfig {
  id: number;
  size: number;
  left: string;
  animDuration: number;
  animDelay: number;
}

const blobs: BlobConfig[] = [
  { id: 1, size: 120, left: '15%', animDuration: 8, animDelay: 0 },
  { id: 2, size: 90, left: '35%', animDuration: 11, animDelay: 2.5 },
  { id: 3, size: 150, left: '55%', animDuration: 9, animDelay: 1 },
  { id: 4, size: 80, left: '70%', animDuration: 14, animDelay: 3.5 },
  { id: 5, size: 110, left: '25%', animDuration: 10, animDelay: 5 },
  { id: 6, size: 100, left: '80%', animDuration: 12, animDelay: 0.5 },
];

/**
 * SteamAnimation — Animated rising steam/mist for cover pages and chapter openers.
 * Six blurred circles rise from ~80% height off-screen.
 * Respects prefers-reduced-motion: renders static blobs if reduced motion is enabled.
 */
const SteamAnimation: React.FC = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {blobs.map((blob) => (
        <div
          key={blob.id}
          className="absolute rounded-full bg-tea-gold"
          style={{
            width: blob.size,
            height: blob.size,
            left: blob.left,
            bottom: '10%',
            opacity: 0.18,
            filter: `blur(${30 + (blob.id % 3) * 7}px)`,
            ...(reducedMotion
              ? {
                  transform: `translateY(-${blob.id * 20}px) scale(1.1)`,
                }
              : {
                  animation: `steamRise ${blob.animDuration}s ${blob.animDelay}s ease-in-out infinite`,
                }),
          }}
        />
      ))}

      {/* Keyframes injected via style tag — only added once */}
      {!reducedMotion && (
        <style>{`
          @keyframes steamRise {
            0% {
              transform: translateY(0) scale(1);
              opacity: 0.18;
            }
            40% {
              opacity: 0.22;
            }
            100% {
              transform: translateY(-120vh) scale(1.5);
              opacity: 0;
            }
          }
        `}</style>
      )}
    </div>
  );
};

export default SteamAnimation;
