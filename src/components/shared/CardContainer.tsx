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
    ? 'bg-tea-elevated border border-tea-border shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
    : 'bg-tea-surface border border-tea-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]';

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`}>
      {children}
    </div>
  );
};

export const CardContainer = React.memo(CardContainerComponent);
