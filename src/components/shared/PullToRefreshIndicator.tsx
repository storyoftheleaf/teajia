import React from 'react';
import { Icons } from '../Icons';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  progress,
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none transition-transform duration-300"
      style={{
        transform: `translateY(${pullDistance}px)`,
        opacity: Math.min(progress * 1.5, 1),
      }}
    >
      <div className="bg-white dark:bg-tea-ink shadow-lg rounded-full p-3 -mt-6">
        <Icons.Leaf
          className={`w-5 h-5 text-tea-seal transition-transform duration-200 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${progress * 360}deg) scale(${0.5 + progress * 0.5})`,
            fill: progress >= 1 ? 'currentColor' : 'none',
          }}
        />
      </div>
    </div>
  );
};
