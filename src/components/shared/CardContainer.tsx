import React from 'react';

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
}

/**
 * Unified card container with consistent styling
 * Used by all card types: Magazine, Teaware, Tea, Education
 * Memoized to prevent unnecessary re-renders when props haven't changed
 */
const CardContainerComponent: React.FC<CardContainerProps> = ({
  children,
  className = '',
  variant = 'dark'
}) => {
  const baseStyles = 'rounded-[1px] overflow-hidden transition-all duration-300';

  const variantStyles = variant === 'dark'
    ? 'bg-tea-ink dark:bg-tea-ink border border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
    : 'bg-tea-paper dark:bg-tea-ink/90 border border-tea-ink/10 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]';

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`}>
      {children}
    </div>
  );
};

export const CardContainer = React.memo(CardContainerComponent);
