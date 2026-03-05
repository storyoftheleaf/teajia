import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div className={`${sizeClasses[size]} border-tea-ink/20 dark:border-tea-paper/20 border-t-tea-seal rounded-full animate-spin ${className}`} />
  );
};

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-tea-ink/10 dark:bg-white/10 rounded ${className}`} />
  );
};
