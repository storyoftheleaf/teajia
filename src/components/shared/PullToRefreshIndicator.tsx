import React from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

/** Simple inline tea leaf SVG */
const TeaLeafIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 1.8 6.6 4.5 8.4" />
    <path d="M17.5 4.5C15 7 13 10 12 14" />
    <path d="M22 2C19 5 15 9 12 14" />
    <path d="M12 14c-1 3-2.5 5.5-4.5 7.5" />
    <path d="M12 14c2 2 4 4.5 5 7" />
  </svg>
);

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  progress,
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const atThreshold = progress >= 1;

  return (
    <div
      className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-modal flex items-center justify-center pointer-events-none transition-transform duration-300"
      style={{
        transform: `translateY(${pullDistance}px)`,
        opacity: Math.min(progress * 1.5, 1),
      }}
    >
      <div className="bg-tea-surface shadow-lg rounded-full p-3 -mt-6">
        <TeaLeafIcon
          className={`w-5 h-5 transition-colors duration-200 ${
            atThreshold || isRefreshing ? 'text-tea-gold' : 'text-tea-text-sec'
          } ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${progress * 360}deg) scale(${0.5 + progress * 0.5})`,
            transition: isRefreshing ? undefined : 'transform 0.1s ease-out',
            fill: atThreshold ? 'currentColor' : 'none',
          }}
        />
      </div>
    </div>
  );
};
