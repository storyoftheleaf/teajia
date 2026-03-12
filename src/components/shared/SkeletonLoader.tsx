import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Skeleton loader component for image placeholders
 * Shows a shimmer animation while images are preloading
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  width = '100%',
  height = '100%',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-tea-text-sec/5 ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      {/* Shimmer animation overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{
          animation: 'shimmer 2s infinite',
          backgroundSize: '200% 100%',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
};
