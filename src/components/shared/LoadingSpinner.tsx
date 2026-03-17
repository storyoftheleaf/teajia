import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 40,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const px = sizeMap[size];
  const strokeWidth = size === 'sm' ? 2.5 : 3;
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className={`animate-spin ${className}`}
      style={{ animationDuration: '1s' }}
      role="status"
      aria-label="Loading"
    >
      {/* Background ring */}
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-tea-text/10"
      />
      {/* Gradient arc */}
      <defs>
        <linearGradient id={`spinner-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--tea-gold)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--tea-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="none"
        stroke={`url(#spinner-grad-${size})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
      />
    </svg>
  );
};

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-tea-text/10 rounded ${className}`} />
  );
};
